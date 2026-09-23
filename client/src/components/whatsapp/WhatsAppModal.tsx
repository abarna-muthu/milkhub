import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { MessageSquare, ExternalLink, Globe } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { buildWhatsAppUrl, generateWhatsAppMessage, WhatsAppPayload } from '../../utils/whatsappUtils';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  mobile: string;
  defaultTemplate?: 'payment_reminder' | 'settlement' | 'daily_collection' | 'statement';
  data?: {
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

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  customerName,
  mobile,
  defaultTemplate = 'payment_reminder',
  data = {},
}) => {
  const { language, t } = useLanguage();
  const [templateType, setTemplateType] = useState<'payment_reminder' | 'settlement' | 'daily_collection' | 'statement'>(defaultTemplate);
  const [msgLang, setMsgLang] = useState<'en' | 'ta'>(language);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTemplateType(defaultTemplate);
  }, [defaultTemplate]);

  useEffect(() => {
    const payload: WhatsAppPayload = {
      customerName,
      mobile,
      templateType,
      language: msgLang,
      data,
    };
    setMessage(generateWhatsAppMessage(payload));
  }, [customerName, mobile, templateType, msgLang, data]);

  const handleSend = () => {
    const url = buildWhatsAppUrl(mobile, message);
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('whatsapp_preview_title')}
      subtitle={`${t('supplier')}: ${customerName} (${mobile})`}
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleSend}
            icon={<ExternalLink className="w-4 h-4" />}
          >
            {t('open_whatsapp')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Template Selector & Language Switch */}
        <div className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded border border-slate-200">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-medium text-slate-700">
              {language === 'ta' ? 'செய்தி மாதிரி:' : 'Template:'}
            </span>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value as any)}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-800"
            >
              <option value="payment_reminder">{t('whatsapp_payment_reminder')}</option>
              <option value="settlement">{t('whatsapp_settlement')}</option>
              <option value="daily_collection">{t('daily_collection')}</option>
              <option value="statement">{t('whatsapp_statement')}</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-slate-500" />
            <button
              type="button"
              onClick={() => setMsgLang('en')}
              className={`px-2 py-0.5 text-xs rounded font-medium ${
                msgLang === 'en'
                  ? 'bg-brand-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setMsgLang('ta')}
              className={`px-2 py-0.5 text-xs rounded font-medium ${
                msgLang === 'ta'
                  ? 'bg-brand-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200'
              }`}
            >
              தமிழ்
            </button>
          </div>
        </div>

        {/* Message Preview Box */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {language === 'ta' ? 'செய்தி முன்னோட்டம்:' : 'Message Preview (Editable):'}
          </label>
          <div className="relative rounded-lg border border-emerald-300 bg-emerald-50/40 p-3 shadow-inner">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 mb-2">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
              WhatsApp Cloud
            </div>
            <textarea
              rows={7}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-xs font-sans bg-white border border-slate-300 rounded p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-800"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            {language === 'ta'
              ? '* குறிப்பு: "வாட்ஸ்அப்பில் திறக்க" பொத்தானை அழுத்தினால் வாட்ஸ்அப் செயலி திறக்கும்.'
              : '* Note: Clicking "Open WhatsApp" will open WhatsApp Web or App with the recipient and message filled.'}
          </p>
        </div>
      </div>
    </Modal>
  );
};
