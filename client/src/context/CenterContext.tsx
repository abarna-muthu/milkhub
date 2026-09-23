import React, { createContext, useContext, useState, useEffect } from 'react';
import { CollectionCenter } from '../types';
import { centersApi } from '../services/api';

interface CenterContextType {
  centers: CollectionCenter[];
  selectedCenterId: string;
  setSelectedCenterId: (id: string) => void;
  selectedCenterName: string;
  refreshCenters: () => Promise<void>;
  isLoading: boolean;
}

const CenterContext = createContext<CenterContextType | undefined>(undefined);

export const CenterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [centers, setCenters] = useState<CollectionCenter[]>([]);
  const [selectedCenterId, setSelectedCenterIdState] = useState<string>(() => {
    return localStorage.getItem('milk_crm_center_id') || 'all';
  });
  const [isLoading, setIsLoading] = useState(false);

  const setSelectedCenterId = (id: string) => {
    setSelectedCenterIdState(id);
    localStorage.setItem('milk_crm_center_id', id);
  };

  const refreshCenters = async () => {
    setIsLoading(true);
    try {
      const data = await centersApi.getAll();
      setCenters(data);
    } catch (err) {
      console.warn('Failed to fetch centers, fallback to default list', err);
      // Fallback centers if backend is spinning up
      setCenters([
        { id: 'c1', name: 'Srivilliputtur Center', location: 'Srivilliputtur', code: 'SVPR', phone: '9842111220', is_active: true, created_at: '' },
        { id: 'c2', name: 'Rajapalayam Center', location: 'Rajapalayam', code: 'RJPM', phone: '9842111221', is_active: true, created_at: '' },
        { id: 'c3', name: 'Sivakasi Center', location: 'Sivakasi', code: 'SVKS', phone: '9842111222', is_active: true, created_at: '' },
        { id: 'c4', name: 'Virudhunagar Center', location: 'Virudhunagar', code: 'VDR', phone: '9842111223', is_active: true, created_at: '' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshCenters();
  }, []);

  const selectedCenter = centers.find((c) => c.id === selectedCenterId);
  const selectedCenterName = selectedCenterId === 'all' ? 'All Collection Centers' : (selectedCenter?.name || 'Main Center');

  return (
    <CenterContext.Provider
      value={{
        centers,
        selectedCenterId,
        setSelectedCenterId,
        selectedCenterName,
        refreshCenters,
        isLoading,
      }}
    >
      {children}
    </CenterContext.Provider>
  );
};

export const useCenter = () => {
  const context = useContext(CenterContext);
  if (!context) {
    throw new Error('useCenter must be used within a CenterProvider');
  }
  return context;
};
