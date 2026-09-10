package com.example.easyreading_rebuild

import android.content.Intent
import android.content.pm.PackageManager
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "easyreading/system"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method == "openTtsSettings") {
                    try {
                        startActivity(Intent("com.android.settings.TTS_SETTINGS"))
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("ERR", e.message, null)
                    }
                } else if (call.method == "isAppInstalled") {
                    try {
                        val packageName = call.argument<String>("packageName")
                        if (packageName != null) {
                            val isInstalled = try {
                                packageManager.getPackageInfo(packageName, 0)
                                true
                            } catch (e: PackageManager.NameNotFoundException) {
                                false
                            }
                            result.success(isInstalled)
                        } else {
                            result.error("ERR", "Package name is null", null)
                        }
                    } catch (e: Exception) {
                        result.error("ERR", e.message, null)
                    }
                } else if (call.method == "launchApp") {
                    try {
                        val packageName = call.argument<String>("packageName")
                        if (packageName != null) {
                            val intent = packageManager.getLaunchIntentForPackage(packageName)
                            if (intent != null) {
                                startActivity(intent)
                                result.success(true)
                            } else {
                                result.success(false)
                            }
                        } else {
                            result.error("ERR", "Package name is null", null)
                        }
                    } catch (e: Exception) {
                        result.error("ERR", e.message, null)
                    }
                } else {
                    result.notImplemented()
                }
            }
    }
}
