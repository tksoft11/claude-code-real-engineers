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
