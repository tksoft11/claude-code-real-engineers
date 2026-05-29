// Feature Flag approach
class OrderCalculatorFactory {
  static create(): IOrderCalculator {
    if (process.env.USE_NEW_CALCULATOR === 'true') {
      return new NewOrderCalculator();  // โค้ดใหม่ที่สะอาด
    }
    return new LegacyOrderCalculator(); // โค้ดเก่าที่ทำงานได้
  }
}
