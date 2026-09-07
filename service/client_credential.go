package service

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service/clientauth"
)

// Bounded locks serialize refreshes in this process; the database transaction also
// serializes refresh-token rotation across gateway instances.
var clientCredentialLocks [64]sync.Mutex

func ResolveClientCredential(ctx context.Context, channelID int) (*clientauth.TokenBundle, error) {
	if channelID <= 0 {
		return nil, fmt.Errorf("invalid client channel")
	}
	lock := &clientCredentialLocks[channelID%len(clientCredentialLocks)]
	lock.Lock()
	defer lock.Unlock()
	ch, err := model.GetChannelById(channelID, true)
	if err != nil {
		return nil, err
	}
	if ch.Type != constant.ChannelTypeClientOAuth {
		return nil, fmt.Errorf("client channel is unavailable")
	}
	var credential clientauth.TokenBundle
	if err := common.Unmarshal([]byte(ch.Key), &credential); err != nil {
		return nil, fmt.Errorf("invalid client credential")
	}
	if credential.AccessToken != "" && time.Until(credential.ExpiresAt) > time.Minute {
		return &credential, nil
	}
	var resolved *clientauth.TokenBundle
	err = model.UpdateClientCredential(ctx, channelID, func(raw string) (string, error) {
		var current clientauth.TokenBundle
		if err := common.Unmarshal([]byte(raw), &current); err != nil {
			return "", fmt.Errorf("invalid client credential")
		}
		resolved = &current
		if current.AccessToken == "" || time.Until(current.ExpiresAt) <= time.Minute {
			var err error
			resolved, err = clientauth.RefreshToken(ctx, &current)
			if err != nil {
				return "", err
			}
		}
		data, err := common.Marshal(resolved)
		return string(data), err
	})
	if err != nil {
		return nil, err
	}
	model.InitChannelCache()
	return resolved, nil
}
