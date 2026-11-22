# 2026-11-18 · 안드로이드 CI OpenJDK 보안 패치 검증 및 Base64 인트린식 차단 (fix/java-base64-ci-guard)

- 안드로이드 빌드 워크플로(`build-hana-sms-bridge.yml`, `build-portal-playstore.yml`)를 OpenJDK 17(`zulu`)로 전환하고 `17.0.21.1` 이상 최소 패치 버전 검증 단계 및 `JAVA_TOOL_OPTIONS: -XX:-UseBASE64Intrinsics` 를 적용했다.
- `android/hana-sms-bridge/gradle.properties` 와 `android/portal-twa/gradle.properties` 의 Gradle·Kotlin 데몬 JVM 인자에 `-XX:-UseBASE64Intrinsics` 방어 옵션을 추가했다.
