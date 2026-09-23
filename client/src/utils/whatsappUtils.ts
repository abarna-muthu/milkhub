export interface WhatsAppPayload {
  customerName: string;
  mobile: string;
  templateType: 'payment_reminder' | 'settlement' | 'daily_collection' | 'statement';
  language: 'en' | 'ta';
  data: {
    month?: string;
    totalMilk?: number;
    totalAmount?: number;
    paidAmount?: number;
    pendingAmount?: number;
    collectionDate?: string;
    session?: string;
    quantity?: number;
    fat?: number;
    snf?: number;
    rate?: number;
    amount?: number;
  };
}

export function generateWhatsAppMessage(payload: WhatsAppPayload): string {
  const { customerName, templateType, language, data } = payload;
  const isTamil = language === 'ta';

  if (templateType === 'settlement') {
    if (isTamil) {
      return `வணக்கம் ${customerName},\n\nMilkHub பால் பண்ணையிலிருந்து உங்கள் ${data.month || 'இந்த மாத'} பால் கணக்கு தீர்வு விவரம்:\n• மொத்த பால்: ${data.totalMilk || 0} லிட்டர்\n• மொத்த தொகை: ₹${data.totalAmount || 0}\n• பெற்றுக் கொண்டது: ₹${data.paidAmount || 0}\n• நிலுவைத் தொகை: ₹${data.pendingAmount || 0}\n\nநன்றி,\nMilkHub பால் சேகரிப்பு மையம்.`;
    }
    return `Dear ${customerName},\n\nYour milk collection settlement for ${data.month || 'this month'} from MilkHub Dairy:\n• Total Milk: ${data.totalMilk || 0} L\n• Total Amount: ₹${data.totalAmount || 0}\n• Paid: ₹${data.paidAmount || 0}\n• Pending: ₹${data.pendingAmount || 0}\n\nThank you,\nMilkHub Dairy.`;
  }

  if (templateType === 'payment_reminder') {
    if (isTamil) {
      return `வணக்கம் ${customerName},\n\nMilkHub பால் பண்ணையிலிருந்து தகவல்: உங்கள் நிலுவைத் தொகை ₹${data.pendingAmount || 0} தயாராக உள்ளது. பால் சேகரிப்பு மையத்தில் பெற்றுக் கொள்ளவும்.\n\nநன்றி!`;
    }
    return `Dear ${customerName},\n\nReminder from MilkHub Dairy: Your pending milk payment of ₹${data.pendingAmount || 0} is ready for collection at the dairy center.\n\nThank you!`;
  }

  if (templateType === 'daily_collection') {
    if (isTamil) {
      return `வணக்கம் ${customerName},\n\nஇன்றைய (${data.collectionDate || 'இன்று'}) பால் சேகரிப்பு விவரம் (${data.session === 'morning' ? 'காலை' : 'மாலை'}):\n• பால் அளவு: ${data.quantity || 0} லிட்டர்\n• கொழுப்பு: ${data.fat || 0}%\n• அடர்த்தி: ${data.snf || 0}%\n• லிட்டர் விலை: ₹${data.rate || 0}\n• இன்றைய தொகை: ₹${data.amount || 0}\n\nMilkHub பால் சேகரிப்பு மையம்.`;
    }
    return `Dear ${customerName},\n\nToday's (${data.collectionDate || 'Today'}) Milk Collection (${data.session}):\n• Quantity: ${data.quantity || 0} L\n• Fat: ${data.fat || 0}%\n• SNF: ${data.snf || 0}%\n• Rate/L: ₹${data.rate || 0}\n• Amount: ₹${data.amount || 0}\n\nMilkHub Dairy Center.`;
  }

  // Default Statement
  if (isTamil) {
    return `வணக்கம் ${customerName},\n\nஉங்கள் நடப்புக் கணக்கு நிலுவை விவரம்:\n• மொத்த பால்: ${data.totalMilk || 0} லிட்டர்\n• மொத்த சம்பாத்தியம்: ₹${data.totalAmount || 0}\n• பட்டுவாடா பெற்றது: ₹${data.paidAmount || 0}\n• பாக்கி நிலுவை: ₹${data.pendingAmount || 0}\n\nMilkHub பால் பண்ணை.`;
  }
  return `Dear ${customerName},\n\nYour dairy account summary from MilkHub Dairy:\n• Total Milk Supplied: ${data.totalMilk || 0} L\n• Total Earnings: ₹${data.totalAmount || 0}\n• Total Received: ₹${data.paidAmount || 0}\n• Current Balance: ₹${data.pendingAmount || 0}\n\nThank you!`;
}

export function formatIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

export function buildWhatsAppUrl(mobile: string, message: string): string {
  const formattedPhone = formatIndianMobile(mobile);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
}
