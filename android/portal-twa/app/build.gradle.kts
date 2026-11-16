plugins {
    id("com.android.application")
}

/* Google Play 업로드 키 고정 서명 설정
   - 저장소에는 서명키(.jks/.keystore)나 비밀번호를 절대 넣지 않는다.
   - GitHub Secret(PORTAL_UPLOAD_KEYSTORE_BASE64 · PORTAL_UPLOAD_STORE_PASSWORD ·
     PORTAL_UPLOAD_KEY_ALIAS · PORTAL_UPLOAD_KEY_PASSWORD)에서 환경변수로 주입한다.
   - 키가 아직 없는 PR 검증 빌드에서는 debug 키로 폴백해 컴파일·패키징(.aab/.apk) 이상 유무를 먼저 검증한다. */
val portalStoreFile: String? = System.getenv("PORTAL_UPLOAD_KEYSTORE_FILE")
val portalStorePassword: String? = System.getenv("PORTAL_UPLOAD_STORE_PASSWORD")
val portalKeyAlias: String? = System.getenv("PORTAL_UPLOAD_KEY_ALIAS")
val portalKeyPassword: String? = System.getenv("PORTAL_UPLOAD_KEY_PASSWORD")
val hasUploadKey: Boolean =
    !portalStoreFile.isNullOrBlank() && file(portalStoreFile).exists() &&
    !portalStorePassword.isNullOrBlank() &&
    !portalKeyAlias.isNullOrBlank() &&
    !portalKeyPassword.isNullOrBlank()

println(
    if (hasUploadKey) "[푸른포털 TWA] 고정 업로드 서명키로 Play 스토어 배포용 AAB/APK를 서명합니다."
    else "[푸른포털 TWA] 안내: PORTAL_UPLOAD_* 서명키가 설정되지 않아 검증용 임시 서명으로 빌드합니다. " +
         "Play Console에 올리기 전 scripts/play-store-setup.js --init-keystore 로 업로드 키를 등록하세요."
)

android {
    namespace = "kr.pureun.portal"
    compileSdk = 36

    defaultConfig {
        applicationId = "kr.pureun.portal"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
    }

    signingConfigs {
        create("upload") {
            if (hasUploadKey) {
                storeFile = file(portalStoreFile!!)
                storePassword = portalStorePassword
                keyAlias = portalKeyAlias
                keyPassword = portalKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = if (hasUploadKey) {
                signingConfigs.getByName("upload")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.core:core:1.15.0")
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.5.0")
}
