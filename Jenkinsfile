pipeline {
  agent any
  tools { nodejs 'nodejs' }

  environment {
    REPO_URL = 'https://github.com/JuanSamuelArbelaez/servicio-notificaciones.git'
    BRANCH = 'main'
    SONAR_SERVER = 'sonar-server'
    EMAIL_TO = 'andresf.rendonn@uqvirtual.edu.co, juans.arbelaezr@uqvirtual.edu.co, joans.gomezu@uqvirtual.edu.co'
    EMAIL_FROM = 'jenkins.bot.microservicios1@gmail.com'
    SERVICE_NAME = 'servicio-notificaciones'
  }

  stages {
    stage('Clonar Repositorio') {
      steps {
        git branch: "${BRANCH}", url: "${REPO_URL}"
      }
    }

    stage('Instalar Dependencias') {
      steps {
        sh 'node --version'
        sh 'npm --version'
        sh 'npm ci'
      }
    }

    stage('Construir Servicio (Build)') {
      steps {
        sh 'npm run build || echo "No hay script de build, continuando..."'
        sh 'npm list --depth=0 || true'
      }
    }

    stage('Sonar Análisis') {
      steps {
        script {
          withSonarQubeEnv("${SONAR_SERVER}") {
            sh """
              sonar-scanner \
                -Dsonar.projectKey=${env.JOB_NAME} \
                -Dsonar.sources=src \
                -Dsonar.exclusions=**/node_modules/**,**/coverage/**,**/*.test.js \
                -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                -Dsonar.sourceEncoding=UTF-8
            """
          }
        }
      }
    }

    stage('QG (Quality Gate)') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          script {
            def qg = waitForQualityGate()
            if (qg.status != 'OK') {
              currentBuild.result = 'UNSTABLE'
              echo "Quality Gate: ${qg.status}"
            } else {
              echo "Quality Gate OK"
            }
          }
        }
      }
    }

    // TODO: Agregar pruebas automatizadas aquí
    // stage('Ejecutar Pruebas') {
    //   steps {
    //     sh 'npm test || echo "No hay pruebas configuradas"'
    //   }
    // }

  } // stages

  post {
    always {
      script {
        def status = currentBuild.currentResult ?: 'SUCCESS'
        def statusColor = (status == 'SUCCESS') ? '#4CAF50' : (status == 'UNSTABLE') ? '#FF9800' : '#F44336'
        def statusIcon = (status == 'SUCCESS') ? '✅' : (status == 'UNSTABLE') ? '⚠️' : '❌'

        def htmlBody = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; text-align: center; }
        .content { background: white; padding: 25px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .info-card { background: #f8f9fa; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }
        .links { margin: 25px 0; text-align: center; }
        .btn { display: inline-block; padding: 10px 20px; margin: 0 10px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; }
        .footer { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        .success { background-color: #4CAF50; color: white; }
        .unstable { background-color: #FF9800; color: white; }
        .failure { background-color: #F44336; color: white; }
        .timestamp { color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Reporte de Integración Continua</h1>
        <p>${SERVICE_NAME} - Pipeline Jenkins</p>
    </div>
    
    <div class="content">
        <div class="status-badge ${status == 'SUCCESS' ? 'success' : status == 'UNSTABLE' ? 'unstable' : 'failure'}">
            ${statusIcon} Estado: ${status}
        </div>
        
        <div class="info-grid">
            <div class="info-card">
                <strong>📋 Proyecto</strong><br>
                ${env.JOB_NAME}<br>
                <span class="timestamp">Build #${env.BUILD_NUMBER}</span>
            </div>
            
            <div class="info-card">
                <strong>📊 Quality Gate</strong><br>
                ${currentBuild.currentResult}<br>
                <span class="timestamp">Análisis de código</span>
            </div>
            
            <div class="info-card">
                <strong>🔧 Rama</strong><br>
                ${env.BRANCH ?: 'main'}<br>
                <span class="timestamp">Branch del repositorio</span>
            </div>
            
            <div class="info-card">
                <strong>⚡ Duración</strong><br>
                ${currentBuild.durationString ?: 'No disponible'}<br>
                <span class="timestamp">Tiempo de ejecución</span>
            </div>
        </div>

        <div class="info-card">
            <strong>🔍 Resumen de Ejecución</strong><br>
            • Instalación de dependencias (npm ci)<br>
            • Compilación del servicio Node.js<br>
            • Análisis estático con SonarQube<br>
            • Validación de Quality Gate<br>
        </div>

        <div class="links">
            <a href="${env.BUILD_URL}" class="btn">📖 Ver Build Completo</a>
            <a href="http://localhost:9000/dashboard?id=${env.JOB_NAME}" class="btn">📊 Dashboard SonarQube</a>
        </div>

        <div class="footer">
            <p>🕐 Fecha de generación: ${new Date().format("dd/MM/yyyy HH:mm:ss")}</p>
            <p>Este es un reporte automático generado por Jenkins CI/CD</p>
        </div>
    </div>
</body>
</html>
"""

        mail(
          to: "${env.EMAIL_TO}",
          from: "${env.EMAIL_FROM}",
          subject: "[${status}] ${env.JOB_NAME} #${env.BUILD_NUMBER}",
          body: htmlBody,
          mimeType: 'text/html'
        )

        echo "Notificación de email enviada correctamente."
      }
    }

    cleanup {
      cleanWs()
    }
  }
}

