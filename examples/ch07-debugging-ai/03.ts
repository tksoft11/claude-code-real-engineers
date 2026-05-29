// regression test สำหรับ duplicate email bug
describe('Order Email Notifications', () => {
  it('should not send duplicate confirmation emails when queue retries', async () => {
    // สร้าง order
    const order = await orderService.create(testOrderData);
    
    // จำลอง queue retry (ส่ง job สองครั้ง)
    const jobId = `order-confirm-${order.id}`;
    await emailQueue.process(jobId);
    await emailQueue.process(jobId); // retry
    
    // ตรวจว่า email ถูกส่งแค่ครั้งเดียว
    expect(mockEmailSender.send).toHaveBeenCalledTimes(1);
  });
});
