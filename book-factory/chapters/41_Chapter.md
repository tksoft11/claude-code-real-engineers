# บทที่ 41: The Fastlane Automator

---

## 😱 ฝันร้ายชื่อว่า "Deploy วันศุกร์บ่าย 4 โมง"

Dev หลาย คนรู้จักความรู้สึกนี้ดี:

```
16:00 — เริ่ม build release สำหรับ App Store
16:15 — Xcode: "Provisioning profile expired"
16:30 — แก้ certificate → "Code signing error: no matching identity"
16:45 — ลอง clean build → "Gradle: SDK version mismatch"
17:00 — หัวหน้าถามว่า "deploy ได้ยัง?"
17:30 — ยังไม่ได้ (ออฟฟิศเริ่มเงียบลงทีละคน)
18:45 — ได้ build สำเร็จ แต่ลืม bump version
19:00 — Submit ไป TestFlight → reject: "Missing export compliance"
19:30 — ศุกร์คืนนี้ไม่มีชีวิต
```

**หลังจาก setup Fastlane + AI:**

```
$ bundle exec fastlane deploy_ios

[16:00] ✅ Certificates renewed automatically
[16:01] ✅ Version bumped: 2.1.3 → 2.1.4
[16:03] ✅ Tests passed (142 tests)
[16:08] ✅ Build signed and archived
[16:09] ✅ Uploaded to TestFlight
[16:09] 🎉 Done! Go home.
```

---

## 🏗️ Architecture: AI-Assisted Deployment Pipeline

```
$ fastlane deploy
        │
        ├── [AI Pre-check] วิเคราะห์ Changelog + บอก risk
        │
        ├── [Cert Manager] Match — จัดการ certs อัตโนมัติ
        │
        ├── [Version Bump] อัปเดต version + build number
        │
        ├── [Test Runner] รัน unit tests
        │
        ├── [Builder] Build release binary
        │
        ├── [Uploader] ส่งขึ้น TestFlight / Play Store
        │
        └── [Notifier] แจ้ง Slack ว่า deploy สำเร็จ
```

---

## 📦 Setup Fastlane

```bash
# ติดตั้ง Fastlane
gem install bundler
echo 'gem "fastlane"' > Gemfile
bundle install

# Initialize
cd ios && bundle exec fastlane init
cd android && bundle exec fastlane init
```

```
your-app/
├── Gemfile
├── fastlane/
│   ├── Fastfile          ← lanes ทั้งหมด
│   ├── Appfile           ← app identifiers
│   ├── Matchfile         ← certificate config
│   └── ai_helper.rb      ← AI integration script
├── ios/
└── android/
```

---

## 📋 Appfile

```ruby
# fastlane/Appfile
app_identifier("com.yourcompany.yourapp")
apple_id("dev@yourcompany.com")
team_id("ABC123DEF")

# Android
json_key_file("fastlane/google-play-key.json")
package_name("com.yourcompany.yourapp")
```

---

## 🔑 Match — จัดการ Certificate แบบ Team

`match` คือวิธีที่ Fastlane แนะนำสำหรับจัดการ iOS certificates — เก็บรวมกันใน Git repo (encrypted) ทุกคนในทีม sync ได้

```ruby
# fastlane/Matchfile
git_url("https://github.com/yourcompany/certificates")
storage_mode("git")
type("appstore")
app_identifier(["com.yourcompany.yourapp"])
username("dev@yourcompany.com")
```

```bash
# ครั้งแรก: สร้าง certificates ใหม่
bundle exec fastlane match appstore

# ครั้งถัดไป: sync อัตโนมัติ (ไม่ถามอีก)
bundle exec fastlane match appstore --readonly
```

---

## 🤖 AI Helper — วิเคราะห์ก่อน Deploy

```ruby
# fastlane/ai_helper.rb
require 'net/http'
require 'json'

def ai_pre_deploy_check(changelog, diff_stat)
  uri = URI("#{ENV['BACKEND_URL']}/api/ai/analyze-release")

  payload = {
    changelog: changelog,
    diff_stat: diff_stat,  # จำนวน files/lines ที่เปลี่ยน
  }.to_json

  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = uri.scheme == 'https'

  request = Net::HTTP::Post.new(uri.path, {
    'Content-Type' => 'application/json',
    'Authorization' => "Bearer #{ENV['DEPLOY_TOKEN']}",
  })
  request.body = payload

  response = http.request(request)
  result = JSON.parse(response.body)

  UI.message "🤖 AI Release Analysis:"
  UI.message "   Risk Level: #{result['riskLevel']}"
  UI.message "   Summary: #{result['summary']}"

  if result['warnings']&.any?
    UI.important "⚠️  Warnings:"
    result['warnings'].each { |w| UI.important "   - #{w}" }
  end

  # Block ถ้า critical risk
  if result['riskLevel'] == 'CRITICAL'
    UI.user_error!("🛑 AI detected critical risks. Fix before deploying.")
  end

  result
end
```

---

## 🚀 Fastfile — Lanes ทั้งหมด

```ruby
# fastlane/Fastfile
default_platform(:ios)

# ────────────────────────────
# SHARED LANES
# ────────────────────────────
lane :bump_version do |options|
  type = options[:type] || 'patch' # major / minor / patch
  # อ่าน version ปัจจุบัน
  current = get_version_number(xcodeproj: "ios/YourApp.xcodeproj")
  parts = current.split('.').map(&:to_i)
  case type
  when 'major' then parts[0] += 1; parts[1] = 0; parts[2] = 0
  when 'minor' then parts[1] += 1; parts[2] = 0
  else parts[2] += 1
  end
  new_version = parts.join('.')
  increment_version_number(version_number: new_version, xcodeproj: "ios/YourApp.xcodeproj")
  UI.success "Version: #{current} → #{new_version}"
  new_version
end

lane :run_tests do
  run_tests(
    workspace: "ios/YourApp.xcworkspace",
    scheme: "YourAppTests",
    clean: true,
    output_files: "test-results.xml"
  )
end

# ────────────────────────────
# iOS LANES
# ────────────────────────────
platform :ios do

  lane :deploy do |options|
    require_relative 'ai_helper'

    # 1. AI Pre-check
    changelog = options[:changelog] || prompt(text: "What changed in this release? ")
    diff_stat = `git diff HEAD~1 --shortstat`.strip
    ai_result = ai_pre_deploy_check(changelog, diff_stat)

    # 2. Sync certificates
    match(type: "appstore", readonly: true)

    # 3. Bump version (default: patch)
    new_version = bump_version(type: options[:bump] || 'patch')

    # 4. Run tests
    run_tests unless options[:skip_tests]

    # 5. Build
    build_app(
      workspace: "ios/YourApp.xcworkspace",
      scheme: "YourApp",
      configuration: "Release",
      export_method: "app-store",
      output_directory: "./build",
      output_name: "YourApp.ipa",
    )

    # 6. Upload to TestFlight
    upload_to_testflight(
      ipa: "./build/YourApp.ipa",
      changelog: changelog,
      distribute_external: false,
      notify_external_testers: false,
    )

    # 7. Commit version bump + tag
    git_commit(
      path: ["ios/YourApp.xcodeproj/project.pbxproj"],
      message: "chore: bump version to #{new_version}"
    )
    add_git_tag(tag: "v#{new_version}")
    push_to_git_remote

    # 8. Notify Slack
    slack(
      message: "✅ iOS #{new_version} uploaded to TestFlight",
      slack_url: ENV['SLACK_WEBHOOK_URL'],
      payload: {
        "Risk Level" => ai_result['riskLevel'],
        "Changelog" => changelog,
      }
    ) if ENV['SLACK_WEBHOOK_URL']

    UI.success "🎉 Deployed iOS #{new_version} to TestFlight!"
  end

  lane :fix_certs do
    match(type: "appstore", force: true)  # regenerate certs
  end

end

# ────────────────────────────
# ANDROID LANES
# ────────────────────────────
platform :android do

  lane :deploy do |options|
    changelog = options[:changelog] || prompt(text: "What changed? ")

    # Bump version code
    increment_version_code(gradle_file_path: "android/app/build.gradle")

    # Run tests
    gradle(task: "test", project_dir: "android") unless options[:skip_tests]

    # Build release AAB
    gradle(
      task: "bundle",
      build_type: "Release",
      project_dir: "android",
      properties: {
        "android.injected.signing.store.file" => ENV['ANDROID_KEYSTORE_PATH'],
        "android.injected.signing.store.password" => ENV['ANDROID_KEYSTORE_PASSWORD'],
        "android.injected.signing.key.alias" => ENV['ANDROID_KEY_ALIAS'],
        "android.injected.signing.key.password" => ENV['ANDROID_KEY_PASSWORD'],
      }
    )

    # Upload to Play Store (Internal track)
    upload_to_play_store(
      track: options[:track] || 'internal',
      aab: "android/app/build/outputs/bundle/release/app-release.aab",
      release_status: "draft",
      changelog_text: changelog,
    )

    slack(
      message: "✅ Android uploaded to Play Store (#{options[:track] || 'internal'})",
      slack_url: ENV['SLACK_WEBHOOK_URL'],
    ) if ENV['SLACK_WEBHOOK_URL']
  end

end
```

---

## 🔧 Backend: AI Release Analyzer Endpoint

```typescript
// backend/src/routes/releases.route.ts
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const client = new Anthropic();

router.post('/analyze-release', async (req, res) => {
  const { changelog, diff_stat } = req.body;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 800,
    system: `คุณคือ Release Manager วิเคราะห์ความเสี่ยงของ mobile app release

ตอบ JSON:
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "summary": "สรุป 1 ประโยค",
  "warnings": ["warning1", "warning2"]
}

CRITICAL = มี breaking change หรือ data loss risk
HIGH = เปลี่ยน core feature หรือ API
MEDIUM = UI/UX changes, new features
LOW = bug fixes, minor updates`,
    messages: [{
      role: 'user',
      content: `Changelog: ${changelog}\nFiles changed: ${diff_stat}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
  try {
    const match = text.match(/\{[\s\S]*\}/);
    res.json(match ? JSON.parse(match[0]) : { riskLevel: 'MEDIUM', summary: 'Unable to analyze', warnings: [] });
  } catch {
    res.json({ riskLevel: 'MEDIUM', summary: 'Analysis failed', warnings: [] });
  }
});

export default router;
```

---

## 🐛 AI Fix สำหรับ Error ทั่วไป

เมื่อ Fastlane fail — ใช้ AI ช่วยอ่าน error ได้เลย:

```bash
# เก็บ error log แล้วส่งให้ AI วิเคราะห์
bundle exec fastlane deploy 2>&1 | tee /tmp/fastlane.log

# ถามผ่าน Claude Code
claude "อ่าน error log นี้และบอกวิธีแก้" < /tmp/fastlane.log
```

**หรือสร้าง lane สำหรับ debug โดยเฉพาะ:**

```ruby
lane :ai_debug do
  log_path = "/tmp/fastlane_error.log"
  # รัน deploy แล้วเก็บ log
  begin
    deploy
  rescue => e
    File.write(log_path, e.message)
    sh("curl -s -X POST #{ENV['BACKEND_URL']}/api/ai/debug-fastlane \
      -H 'Content-Type: application/json' \
      -d '{\"error\": #{e.message.to_json}}' | jq .solution")
  end
end
```

---

## 🌐 GitHub Actions: Auto Deploy on Tag

```yaml
# .github/workflows/deploy-mobile.yml
name: Deploy Mobile Apps

on:
  push:
    tags: ['v*']   # trigger เมื่อ push tag เช่น v2.1.4

jobs:
  deploy-ios:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true

      - name: Setup certificates
        env:
          MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
          MATCH_GIT_TOKEN: ${{ secrets.MATCH_GIT_TOKEN }}
        run: bundle exec fastlane match appstore --readonly

      - name: Deploy to TestFlight
        env:
          APP_STORE_CONNECT_API_KEY_ID: ${{ secrets.ASC_KEY_ID }}
          APP_STORE_CONNECT_API_ISSUER_ID: ${{ secrets.ASC_ISSUER_ID }}
          APP_STORE_CONNECT_API_KEY_CONTENT: ${{ secrets.ASC_KEY_CONTENT }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: bundle exec fastlane ios deploy skip_tests:false

  deploy-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.2'
          bundler-cache: true

      - name: Deploy to Play Store
        env:
          ANDROID_KEYSTORE_PATH: ${{ secrets.ANDROID_KEYSTORE_PATH }}
          ANDROID_KEYSTORE_PASSWORD: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}
          ANDROID_KEY_ALIAS: ${{ secrets.ANDROID_KEY_ALIAS }}
          ANDROID_KEY_PASSWORD: ${{ secrets.ANDROID_KEY_PASSWORD }}
        run: bundle exec fastlane android deploy track:internal
```

---

## 🎯 สรุปบทที่ 41

| Component | หน้าที่ |
|-----------|--------|
| `Matchfile` | Sync iOS certificates ทั้งทีมจาก Git repo เดียว |
| `ai_helper.rb` | Call AI API วิเคราะห์ risk ก่อน deploy |
| `Fastfile` (iOS) | match → bump → test → build → TestFlight → notify |
| `Fastfile` (Android) | bump → test → gradle → Play Store → notify |
| Backend `/analyze-release` | AI ประเมิน changelog → riskLevel + warnings |
| GitHub Actions | Auto deploy เมื่อ push git tag |

**หลักการ:** Fastlane จัดการ mechanical steps, AI จัดการ judgment calls (risk assessment)

---

## 📋 Action Items ก่อนไปบทที่ 42

- [ ] ติดตั้ง Fastlane และรัน `fastlane init` ใน iOS และ Android folder
- [ ] Setup `match` กับ private Git repo สำหรับ certificates
- [ ] เพิ่ม secrets ทั้งหมดใน GitHub Repository Settings
- [ ] ทดสอบ lane ด้วย `bundle exec fastlane ios deploy skip_tests:true`
- [ ] ตั้ง Slack webhook สำหรับ deploy notifications

---

*ใน **บทที่ 42** เราจะสร้าง Capstone ของ Volume 3 ทั้งหมด: **The Enterprise Auto-Fix Pipeline** — ระบบที่ monitor production errors, ให้ AI สร้าง PR แก้บั๊กอัตโนมัติ แล้วรอแค่กดปุ่ม Merge ครับ*
