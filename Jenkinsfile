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
        IMAGE_NAME = 'new-api'
    }

    stages {
        stage('Checkout') {
            steps {
                echo '📥 正在检出最新代码...'
                checkout scm
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

        stage('Cleanup Dangling Images') {
            steps {
                echo '🧹 清理构建产生的悬空无用镜像...'
                sh '''
                    docker image prune -f || true
                '''
            }
        }
    }

    post {
        success {
            echo "🎉 [new-api] 构建成功！镜像标签: ${IMAGE_NAME}:latest, ${IMAGE_NAME}:${BUILD_NUMBER}"
        }
        failure {
            echo '❌ [new-api] 构建失败，请查看控制台输出排查问题。'
        }
    }
}
