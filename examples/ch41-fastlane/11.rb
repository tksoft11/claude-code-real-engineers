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
