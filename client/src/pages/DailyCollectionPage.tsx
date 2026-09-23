import React, { useState, useEffect } from 'react';
import { Milk, RefreshCw } from 'lucide-react';
import { FastCollectionForm } from '../components/collection/FastCollectionForm';
import { TodayCollectionTable } from '../components/collection/TodayCollectionTable';
import { Button } from '../components/common/Button';
import { MilkCollection } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useCenter } from '../context/CenterContext';
import { collectionsApi } from '../services/api';

interface DailyCollectionPageProps {
  onNavigate: (path: string, param?: string) => void;
}

export const DailyCollectionPage: React.FC<DailyCollectionPageProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const { selectedCenterId, selectedCenterName } = useCenter();

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTodayCollections = async () => {
    setIsLoading(true);
    try {
      const data = await collectionsApi.getAll({
        center_id: selectedCenterId,
        date: selectedDate,
      });
      setCollections(data);
    } catch (err) {
      console.warn('Failed to load collections', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTodayCollections();
  }, [selectedCenterId, selectedDate]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {t('daily_collection')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('intake_workflow_subtitle')} • <span className="font-semibold text-brand-900">{selectedCenterName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTodayCollections}
            isLoading={isLoading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Fast Collection Input Form */}
      <FastCollectionForm
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onCollectionSaved={loadTodayCollections}
      />

      {/* Today's Collection Register Table */}
      <TodayCollectionTable
        collections={collections}
        onRefresh={loadTodayCollections}
      />
    </div>
  );
};
