# เก็บ error log แล้วส่งให้ AI วิเคราะห์
bundle exec fastlane deploy 2>&1 | tee /tmp/fastlane.log

# ถามผ่าน Claude Code
claude "อ่าน error log นี้และบอกวิธีแก้" < /tmp/fastlane.log
