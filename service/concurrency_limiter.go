package service

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const (
	defaultConcurrencyTTL = 300 * time.Second // 5 minutes safety TTL
)

// ConcurrencyLimitError indicates that an in-flight concurrency threshold was reached.
type ConcurrencyLimitError struct {
	Dimension  string // "user_group", "model_set", "model"
	TargetName string
	Current    int
	Limit      int
}

func (e *ConcurrencyLimitError) Error() string {
	dimName := "对象"
	switch e.Dimension {
	case "user_group":
		dimName = "用户组"
	case "model_set":
		dimName = "模型集"
	case "model":
		dimName = "模型"
	case "grant":
		dimName = "授权策略"
	}
	return fmt.Sprintf("并发请求数已达上限: %s [%s] 当前并发数 %d 已达最高限制 %d", dimName, e.TargetName, e.Current, e.Limit)
}

type concurrencyTarget struct {
	Key        string
	Limit      int
	Dimension  string
	TargetName string
}

// In-memory fallback limiter for non-Redis environments
type memoryConcurrencyLimiter struct {
	mu     sync.Mutex
	counts map[string]int
}

var globalMemoryLimiter = &memoryConcurrencyLimiter{
	counts: make(map[string]int),
}

func (m *memoryConcurrencyLimiter) acquire(targets []concurrencyTarget) (func(), *ConcurrencyLimitError) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 1. Check all limits
	for _, t := range targets {
		if t.Limit > 0 {
			cur := m.counts[t.Key]
			if cur >= t.Limit {
				return nil, &ConcurrencyLimitError{
					Dimension:  t.Dimension,
					TargetName: t.TargetName,
					Current:    cur,
					Limit:      t.Limit,
				}
			}
		}
	}

	// 2. Increment all
	for _, t := range targets {
		if t.Limit > 0 {
			m.counts[t.Key]++
		}
	}

	var once sync.Once
	release := func() {
		once.Do(func() {
			m.mu.Lock()
			defer m.mu.Unlock()
			for _, t := range targets {
				if t.Limit > 0 {
					m.counts[t.Key]--
					if m.counts[t.Key] <= 0 {
						delete(m.counts, t.Key)
					}
				}
			}
		})
	}
	return release, nil
}

const concurrencyAcquireLua = `
local n = #KEYS
local ttl = tonumber(ARGV[n + 1])
for i = 1, n do
    local limit = tonumber(ARGV[i])
    if limit > 0 then
        local current = tonumber(redis.call('GET', KEYS[i]) or '0')
        if current >= limit then
            return {0, tostring(i), tostring(current), tostring(limit)}
        end
    end
end
for i = 1, n do
    local limit = tonumber(ARGV[i])
    if limit > 0 then
        redis.call('INCR', KEYS[i])
        redis.call('EXPIRE', KEYS[i], ttl)
    end
end
return {1, '', '0', '0'}
`

const concurrencyReleaseLua = `
for i = 1, #KEYS do
    local current = tonumber(redis.call('GET', KEYS[i]) or '0')
    if current > 1 then
        redis.call('DECR', KEYS[i])
    else
        redis.call('DEL', KEYS[i])
    end
end
return 1
`

// ResolveConcurrencyTargets gathers all applicable concurrency limits for a user and model.
func ResolveConcurrencyTargets(userId int, modelName string) ([]concurrencyTarget, error) {
	if modelName == "" {
		return nil, nil
	}

	var targets []concurrencyTarget
	seenKeys := make(map[string]bool)

	// 1. User Groups Concurrency
	if userId > 0 {
		userGroups, err := model.GetUserGroupsByUserId(userId)
		if err == nil {
			for _, ug := range userGroups {
				if ug != nil && ug.MaxConcurrency > 0 {
					k := "concurrency:ug:" + strconv.Itoa(ug.Id)
					if !seenKeys[k] {
						seenKeys[k] = true
						targets = append(targets, concurrencyTarget{
							Key:        k,
							Limit:      ug.MaxConcurrency,
							Dimension:  "user_group",
							TargetName: ug.Name,
						})
					}
				}
			}
		}
	}

	// 2. Model Sets Concurrency
	setIds, _ := model.GetModelSetIdsByModelName(modelName)
	normModel := ratio_setting.FormatMatchingModelName(modelName)
	if normModel != "" && normModel != modelName {
		normSetIds, _ := model.GetModelSetIdsByModelName(normModel)
		setIds = append(setIds, normSetIds...)
	}

	if len(setIds) > 0 {
		// Deduplicate set IDs
		uniqueSetMap := make(map[int]bool, len(setIds))
		var uniqueSetIds []int
		for _, id := range setIds {
			if id > 0 && !uniqueSetMap[id] {
				uniqueSetMap[id] = true
				uniqueSetIds = append(uniqueSetIds, id)
			}
		}

		if len(uniqueSetIds) > 0 {
			modelSets, err := model.GetModelSetsByIds(uniqueSetIds)
			if err == nil {
				for _, set := range modelSets {
					if set != nil && set.MaxConcurrency > 0 {
						k := "concurrency:set:" + strconv.Itoa(set.Id)
						if !seenKeys[k] {
							seenKeys[k] = true
							targets = append(targets, concurrencyTarget{
								Key:        k,
								Limit:      set.MaxConcurrency,
								Dimension:  "model_set",
								TargetName: set.Name,
							})
						}
					}
				}
			}
		}
	}

	// 3. Model Concurrency
	m, _ := model.GetModelByName(modelName)
	if m == nil && normModel != "" && normModel != modelName {
		m, _ = model.GetModelByName(normModel)
	}
	if m != nil && m.MaxConcurrency > 0 {
		k := "concurrency:model:" + m.ModelName
		if !seenKeys[k] {
			seenKeys[k] = true
			targets = append(targets, concurrencyTarget{
				Key:        k,
				Limit:      m.MaxConcurrency,
				Dimension:  "model",
				TargetName: m.ModelName,
			})
		}
	}

	// 4. Grant Policy Concurrency
	if userId > 0 {
		policy, _ := model.GetEffectiveGrantPolicyForUser(userId, modelName)
		if policy != nil && policy.MaxConcurrency > 0 {
			k := "concurrency:grant:" + strconv.Itoa(policy.GrantId)
			if !seenKeys[k] {
				seenKeys[k] = true
				targets = append(targets, concurrencyTarget{
					Key:        k,
					Limit:      policy.MaxConcurrency,
					Dimension:  "grant",
					TargetName: fmt.Sprintf("授权策略#%d", policy.GrantId),
				})
			}
		}
	}

	return targets, nil
}

// AcquireConcurrency attempts to acquire in-flight concurrency slots for all applicable
// limits (user group, model set, and model).
// If successful, returns a release function that must be called when the request completes.
// If any limit is exceeded, returns a *ConcurrencyLimitError.
func AcquireConcurrency(ctx context.Context, userId int, modelName string) (func(), *ConcurrencyLimitError) {
	targets, err := ResolveConcurrencyTargets(userId, modelName)
	if err != nil || len(targets) == 0 {
		return func() {}, nil
	}

	// 1. If Redis is enabled, execute atomic Lua acquire
	if common.RedisEnabled && common.RDB != nil {
		keys := make([]string, len(targets))
		argv := make([]interface{}, len(targets)+1)
		for i, t := range targets {
			keys[i] = t.Key
			argv[i] = t.Limit
		}
		argv[len(targets)] = int(defaultConcurrencyTTL.Seconds())

		res, rErr := common.RDB.Eval(ctx, concurrencyAcquireLua, keys, argv...).Slice()
		if rErr != nil {
			logger.LogError(ctx, fmt.Sprintf("concurrency limiter redis eval error: %v, falling back to memory limiter", rErr))
			return globalMemoryLimiter.acquire(targets)
		}

		if len(res) >= 4 {
			ok, _ := strconv.Atoi(fmt.Sprintf("%v", res[0]))
			if ok == 0 {
				idx, _ := strconv.Atoi(fmt.Sprintf("%v", res[1]))
				cur, _ := strconv.Atoi(fmt.Sprintf("%v", res[2]))
				lim, _ := strconv.Atoi(fmt.Sprintf("%v", res[3]))
				failedTarget := targets[0]
				if idx >= 1 && idx <= len(targets) {
					failedTarget = targets[idx-1]
				}
				return nil, &ConcurrencyLimitError{
					Dimension:  failedTarget.Dimension,
					TargetName: failedTarget.TargetName,
					Current:    cur,
					Limit:      lim,
				}
			}
		}

		var once sync.Once
		releaseFunc := func() {
			once.Do(func() {
				_ = common.RDB.Eval(context.Background(), concurrencyReleaseLua, keys).Err()
			})
		}
		return releaseFunc, nil
	}

	// 2. Local in-memory limiter fallback
	return globalMemoryLimiter.acquire(targets)
}
