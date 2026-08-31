pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    triggers {
        githubPush()
        pollSCM('H/2 * * * *')
    }

    environment {
        IMAGE_NAME     = 'new-api'
        CONTAINER_NAME = 'new-api-app'
        HOST_PORT      = '3000'
        CONTAINER_PORT = '3000'
        SQL_DSN        = 'postgresql://root:root@zevin.xin:35432/new_api_test?sslmode=disable'
        REDIS_CONN     = 'redis://:redis%40123@zevin.xin:36379/2'
        SESSION_SECRET = 'B7A26D0B-F51C-49C0-A308-E50A007B6A81'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📥 正在拉取最新代码...'
                git branch: 'codex/latest-backend-classic', url: 'https://github.com/zevin-cloud/new-api.git'
            }
        }

        stage('Build Docker Image') {
            steps {
                echo '🐳 正在构建 Docker 镜像...'
                sh '''
                    docker build \
                        -t ${IMAGE_NAME}:latest \
                        -t ${IMAGE_NAME}:${BUILD_NUMBER} \
                        -f Dockerfile .
                '''
            }
        }

        stage('Deploy & Run Container') {
            steps {
                echo '🚀 正在部署并启动新版本容器...'
                sh '''
                    # 停止并移除已有容器
                    docker rm -f ${CONTAINER_NAME} || true

                    # 启动新容器并注入独立数据库环境 (new_api_test / redis db 2)
                    docker run -d \
                        --name ${CONTAINER_NAME} \
                        --restart unless-stopped \
                        -p ${HOST_PORT}:${CONTAINER_PORT} \
                        -e PORT=${CONTAINER_PORT} \
                        -e GIN_MODE=release \
                        -e SQL_DSN="${SQL_DSN}" \
                        -e REDIS_CONN_STRING="${REDIS_CONN}" \
                        -e SESSION_SECRET="${SESSION_SECRET}" \
                        -e MEMORY_CACHE_ENABLED=true \
                        -e SYNC_FREQUENCY=60 \
                        -e CHANNEL_UPDATE_FREQUENCY=30 \
                        -e BATCH_UPDATE_ENABLED=true \
                        -e BATCH_UPDATE_INTERVAL=5 \
                        ${IMAGE_NAME}:latest
                '''
            }
        }

        stage('Health Check') {
            steps {
                echo '🩺 正在检查容器运行状态...'
                sh '''
                    sleep 5
                    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}"
                '''
            }
        }

        stage('Cleanup Dangling Images') {
            steps {
                echo '🧹 清理构建产生的悬空镜像...'
                sh '''
                    docker image prune -f || true
                '''
            }
        }
    }

    post {
        success {
            echo "🎉 [new-api] 构建与部署成功！服务端口: ${HOST_PORT}，数据库: new_api_test"
        }
        failure {
            echo '❌ [new-api] 构建或部署失败，请查看控制台日志。'
        }
    }
}
