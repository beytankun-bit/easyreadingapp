// Root Gradle script - burada android{} / flutter{} BLOKLARI OLMAYACAK

import org.gradle.api.tasks.Delete

plugins {
    // Versiyon belirtmiyoruz; versiyonlar settings.gradle.kts içinden geliyor
    id("com.android.application") apply false
    id("org.jetbrains.kotlin.android") apply false
}

// Tüm modüller için repository ayarları
allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// EasyReading için minimum / target / compile SDK değerleri
extra["minSdkVersion"] = 21        // pdfrx (PDFium) için minimum 21 zorunlu; 23'ten düşürdük
extra["targetSdkVersion"] = 36
extra["compileSdkVersion"] = 36
extra["ndkVersion"] = "27.0.12077973"  // NDK versiyonunu sabitle → JNI hatalarını önler

// AGP 8+ namespace fix: eski plugin'lerin namespace eksikliğini otomatik tamamlar
subprojects {
    afterEvaluate {
        val androidExt = extensions.findByName("android")
        if (androidExt != null) {
            val androidExtClass = androidExt::class.java
            try {
                val nsMethod = androidExtClass.getMethod("getNamespace")
                val ns = nsMethod.invoke(androidExt) as? String
                if (ns.isNullOrBlank()) {
                    val setNs = androidExtClass.getMethod("setNamespace", String::class.java)
                    setNs.invoke(androidExt, project.group.toString().ifBlank { project.name })
                }
            } catch (_: Exception) { /* namespace zaten tanımlıysa geç */ }
        }
    }
}

// Temizlik görevi
tasks.register<Delete>("clean") {
    delete(rootProject.buildDir)
}
