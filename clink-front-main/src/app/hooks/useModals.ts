import { useState } from 'react';

export const useModals = () => {
  const [showMandatoryConnectionModal, setShowMandatoryConnectionModal] =
    useState(false);
  const [showProviderConnectionModal, setShowProviderConnectionModal] =
    useState(false);

  const openMandatoryConnectionModal = () => {
    setShowMandatoryConnectionModal(true);
  };

  const closeMandatoryConnectionModal = () => {
    setShowMandatoryConnectionModal(false);
  };

  return {
    showMandatoryConnectionModal,
    showProviderConnectionModal,
    setShowProviderConnectionModal,
    openMandatoryConnectionModal,
    closeMandatoryConnectionModal,
  };
};
