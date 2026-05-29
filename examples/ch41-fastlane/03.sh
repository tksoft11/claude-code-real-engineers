# ติดตั้ง Fastlane
gem install bundler
echo 'gem "fastlane"' > Gemfile
bundle install

# Initialize
cd ios && bundle exec fastlane init
cd android && bundle exec fastlane init
