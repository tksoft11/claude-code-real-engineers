# ครั้งแรก: สร้าง certificates ใหม่
bundle exec fastlane match appstore

# ครั้งถัดไป: sync อัตโนมัติ (ไม่ถามอีก)
bundle exec fastlane match appstore --readonly
