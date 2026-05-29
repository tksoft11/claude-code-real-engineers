async function resilientTask() {
  let attempts = 0;
  const maxAutoFix = 3;

  while (attempts < maxAutoFix) {
    try {
      await performTask();
      return; // สำเร็จ
    } catch (error) {
      attempts++;
      logger.error(`Task failed (attempt ${attempts}): ${error.message}`);

      const fix = await tryAutoFix(error);
      if (fix.fixed) {
        logger.info(`Auto-fixed: ${fix.action}. Retrying...`);
        continue; // ลองใหม่หลัง fix
      }

      // แก้ไม่ได้ → escalate
      await escalateToHuman(error, fix.action);
      throw error;
    }
  }

  await escalateToHuman(new Error('Max auto-fix attempts reached'));
}
