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
