package com.cloudwatchdashboard

import android.content.Intent
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class PdfPrintModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PdfPrintModule"

    @ReactMethod
    fun printToFileAsync(options: ReadableMap, promise: Promise) {
        try {
            val serverName = if (options.hasKey("serverName")) options.getString("serverName") ?: "Servidor" else "Servidor"
            val provider = if (options.hasKey("provider")) options.getString("provider") ?: "OCI" else "OCI"
            val region = if (options.hasKey("region")) options.getString("region") ?: "sa-saopaulo-1" else "sa-saopaulo-1"
            val status = if (options.hasKey("status")) options.getString("status") ?: "HEALTHY" else "HEALTHY"
            val cpu = if (options.hasKey("cpu")) options.getString("cpu") ?: "0%" else "0%"
            val memory = if (options.hasKey("memory")) options.getString("memory") ?: "0%" else "0%"
            val auditor = if (options.hasKey("auditor")) options.getString("auditor") ?: "João Gabriel Barros Guimarães - FATEC 4DSM" else "João Gabriel Barros Guimarães - FATEC 4DSM"
            val ocid = if (options.hasKey("ocid")) options.getString("ocid") ?: "" else ""
            val sla = if (options.hasKey("sla")) options.getString("sla") ?: "99.95%" else "99.95%"

            val document = PdfDocument()
            val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create()
            val page = document.startPage(pageInfo)
            val canvas = page.canvas

            // Header Background (Dark Blue/Navy)
            val bgPaint = Paint().apply { color = Color.parseColor("#091122") }
            canvas.drawRect(0f, 0f, 595f, 95f, bgPaint)

            // Header Title
            val titlePaint = Paint().apply {
                color = Color.WHITE
                textSize = 14.5f
                isFakeBoldText = true
                isAntiAlias = true
            }
            canvas.drawText("CloudWatch Dashboard - Relatório de Telemetria e SLA", 28f, 44f, titlePaint)

            val subTitlePaint = Paint().apply {
                color = Color.parseColor("#38BDF8")
                textSize = 9.5f
                isAntiAlias = true
            }
            canvas.drawText("Auditoria Técnica e Monitoramento Multi-Cloud (OCI / AWS / GCP)", 28f, 66f, subTitlePaint)

            // Body Background
            val bodyBg = Paint().apply { color = Color.parseColor("#F8FAFC") }
            canvas.drawRect(0f, 95f, 595f, 842f, bodyBg)

            // Meta Info
            val nowStr = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm:ss", Locale.getDefault()).format(Date())
            val metaPaint = Paint().apply {
                color = Color.parseColor("#475569")
                textSize = 9f
                isAntiAlias = true
            }
            val metaBold = Paint().apply {
                color = Color.parseColor("#0F172A")
                textSize = 9f
                isFakeBoldText = true
                isAntiAlias = true
            }

            canvas.drawText("Data de Emissão:", 28f, 125f, metaBold)
            canvas.drawText(nowStr, 120f, 125f, metaPaint)

            canvas.drawText("Auditor Técnico:", 28f, 143f, metaBold)
            canvas.drawText(auditor, 120f, 143f, metaPaint)

            canvas.drawText("Disponibilidade SLA:", 340f, 125f, metaBold)
            canvas.drawText(sla, 455f, 125f, metaPaint)

            canvas.drawText("Identificador:", 340f, 143f, metaBold)
            val ocidShort = if (ocid.length > 24) ocid.substring(0, 24) + "..." else ocid
            canvas.drawText(ocidShort, 415f, 143f, metaPaint)

            // Table Header Bar
            val thBg = Paint().apply { color = Color.parseColor("#1E293B") }
            canvas.drawRoundRect(RectF(28f, 170f, 567f, 198f), 6f, 6f, thBg)

            val thText = Paint().apply {
                color = Color.WHITE
                textSize = 8.5f
                isFakeBoldText = true
                isAntiAlias = true
            }
            canvas.drawText("NOME DO SERVIDOR", 38f, 188f, thText)
            canvas.drawText("PROVEDOR", 200f, 188f, thText)
            canvas.drawText("REGIÃO", 280f, 188f, thText)
            canvas.drawText("STATUS SEMÁFORO", 370f, 188f, thText)
            canvas.drawText("CPU", 475f, 188f, thText)
            canvas.drawText("MEMÓRIA", 520f, 188f, thText)

            // Table Row 1
            val trBg = Paint().apply { color = Color.WHITE }
            canvas.drawRoundRect(RectF(28f, 204f, 567f, 242f), 6f, 6f, trBg)

            val borderPaint = Paint().apply {
                color = Color.parseColor("#E2E8F0")
                style = Paint.Style.STROKE
                strokeWidth = 1f
            }
            canvas.drawRoundRect(RectF(28f, 204f, 567f, 242f), 6f, 6f, borderPaint)

            val trText = Paint().apply {
                color = Color.parseColor("#0F172A")
                textSize = 8.5f
                isAntiAlias = true
            }
            val trTextBold = Paint().apply {
                color = Color.parseColor("#0F172A")
                textSize = 8.5f
                isFakeBoldText = true
                isAntiAlias = true
            }

            val displayName = if (serverName.length > 24) serverName.substring(0, 24) + ".." else serverName
            canvas.drawText(displayName, 38f, 226f, trTextBold)
            canvas.drawText(provider, 200f, 226f, trText)
            canvas.drawText(region, 280f, 226f, trText)

            val statusColor = when (status) {
                "CRITICAL" -> Color.parseColor("#DC2626")
                "WARNING" -> Color.parseColor("#D97706")
                else -> Color.parseColor("#16A34A")
            }
            val statusPaint = Paint().apply {
                color = statusColor
                textSize = 8.5f
                isFakeBoldText = true
                isAntiAlias = true
            }
            val statusText = when (status) {
                "CRITICAL" -> "🔴 CRÍTICO"
                "WARNING" -> "🟡 ATENÇÃO"
                else -> "🟢 OPERACIONAL"
            }
            canvas.drawText(statusText, 370f, 226f, statusPaint)
            canvas.drawText(cpu, 475f, 226f, trTextBold)
            canvas.drawText(memory, 520f, 226f, trTextBold)

            // Section: Métricas
            val secTitle = Paint().apply {
                color = Color.parseColor("#0F172A")
                textSize = 11f
                isFakeBoldText = true
                isAntiAlias = true
            }
            canvas.drawText("Métricas de Telemetria e Desempenho", 28f, 275f, secTitle)

            val cardBg = Paint().apply { color = Color.WHITE }
            val cardBorder = Paint().apply {
                color = Color.parseColor("#E2E8F0")
                style = Paint.Style.STROKE
                strokeWidth = 1f
            }

            // 1. CPU
            canvas.drawRoundRect(RectF(28f, 290f, 155f, 345f), 8f, 8f, cardBg)
            canvas.drawRoundRect(RectF(28f, 290f, 155f, 345f), 8f, 8f, cardBorder)
            canvas.drawText("CONSUMO CPU", 38f, 308f, metaPaint)
            val valPaint = Paint().apply {
                color = Color.parseColor("#0284C7")
                textSize = 14f
                isFakeBoldText = true
                isAntiAlias = true
            }
            canvas.drawText(cpu, 38f, 332f, valPaint)

            // 2. RAM
            canvas.drawRoundRect(RectF(165f, 290f, 292f, 345f), 8f, 8f, cardBg)
            canvas.drawRoundRect(RectF(165f, 290f, 292f, 345f), 8f, 8f, cardBorder)
            canvas.drawText("MEMÓRIA ALOCADA", 175f, 308f, metaPaint)
            canvas.drawText(memory, 175f, 332f, valPaint)

            // 3. SLA
            canvas.drawRoundRect(RectF(302f, 290f, 429f, 345f), 8f, 8f, cardBg)
            canvas.drawRoundRect(RectF(302f, 290f, 429f, 345f), 8f, 8f, cardBorder)
            canvas.drawText("SLA UPTIME", 312f, 308f, metaPaint)
            val slaPaint = Paint().apply {
                color = Color.parseColor("#16A34A")
                textSize = 14f
                isFakeBoldText = true
                isAntiAlias = true
            }
            canvas.drawText(sla, 312f, 332f, slaPaint)

            // 4. Semáforo
            canvas.drawRoundRect(RectF(439f, 290f, 567f, 345f), 8f, 8f, cardBg)
            canvas.drawRoundRect(RectF(439f, 290f, 567f, 345f), 8f, 8f, cardBorder)
            canvas.drawText("SEMÁFORO ATIVO", 449f, 308f, metaPaint)
            canvas.drawText(statusText, 449f, 332f, statusPaint)

            // Section: Conclusão
            canvas.drawText("Parecer Técnico da Infraestrutura", 28f, 380f, secTitle)
            val conclusionBox = RectF(28f, 395f, 567f, 475f)
            canvas.drawRoundRect(conclusionBox, 8f, 8f, cardBg)
            canvas.drawRoundRect(conclusionBox, 8f, 8f, cardBorder)

            val conclPaint = Paint().apply {
                color = Color.parseColor("#475569")
                textSize = 8.5f
                isAntiAlias = true
            }
            canvas.drawText("1. A instância analisada opera em conformidade com as políticas corporativas de governança multi-cloud.", 38f, 418f, conclPaint)
            canvas.drawText("2. Nível de serviço (SLA) registrado dentro dos parâmetros aceitáveis de disponibilidade contínua.", 38f, 438f, conclPaint)
            canvas.drawText("3. Relatório digital emitido pelo CloudWatch Dashboard (Sprint 1) com chancela técnica de auditoria.", 38f, 458f, conclPaint)

            // Divider & Footer
            val footerPaint = Paint().apply {
                color = Color.parseColor("#94A3B8")
                textSize = 8f
                isAntiAlias = true
            }
            val dividerPaint = Paint().apply {
                color = Color.parseColor("#CBD5E1")
                strokeWidth = 0.8f
            }
            canvas.drawLine(28f, 790f, 567f, 790f, dividerPaint)
            canvas.drawText("CloudWatch Dashboard • FATEC São José dos Campos (DSM) • Prof. Dr. Eng. Gerson Penha", 28f, 808f, footerPaint)
            canvas.drawText("Página 1 de 1 • Formato A4 Corporativo", 410f, 808f, footerPaint)

            document.finishPage(page)

            val fileName = "CloudWatch_Relatorio_${System.currentTimeMillis()}.pdf"
            val outputFile = File(reactContext.cacheDir, fileName)
            val fos = FileOutputStream(outputFile)
            document.writeTo(fos)
            document.close()
            fos.close()

            val result = Arguments.createMap()
            result.putString("uri", "file://" + outputFile.absolutePath)
            result.putString("filePath", outputFile.absolutePath)
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("PDF_ERROR", "Falha ao gerar PDF nativo: " + e.message, e)
        }
    }

    @ReactMethod
    fun sharePdf(filePathOrUri: String, title: String, promise: Promise) {
        try {
            val cleanPath = filePathOrUri.removePrefix("file://")
            val file = File(cleanPath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Arquivo PDF não encontrado: $cleanPath")
                return
            }

            val context = reactApplicationContext
            val contentUri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )

            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_SUBJECT, title)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(sendIntent, title).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val currentActivity = currentActivity
            if (currentActivity != null) {
                currentActivity.startActivity(chooser)
            } else {
                context.startActivity(chooser)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHARE_ERROR", "Falha ao compartilhar PDF: " + e.message, e)
        }
    }
}
