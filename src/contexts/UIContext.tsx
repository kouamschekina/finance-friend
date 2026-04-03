import React, { createContext, useContext, useState } from 'react';

interface UIContextType {
    isTransactionDrawerOpen: boolean;
    openTransactionDrawer: (editingId?: string) => void;
    closeTransactionDrawer: () => void;
    editingTransactionId: string | null;
    isCategoryDrawerOpen: boolean;
    openCategoryDrawer: (editingId?: string) => void;
    closeCategoryDrawer: () => void;
    editingCategoryId: string | null;
    isGoalDrawerOpen: boolean;
    openGoalDrawer: (editingId?: string) => void;
    closeGoalDrawer: () => void;
    editingGoalId: string | null;
    isSettingsDrawerOpen: boolean;
    openSettingsDrawer: () => void;
    closeSettingsDrawer: () => void;
}

const UIContext = createContext<UIContextType | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [isTransactionDrawerOpen, setIsTransactionDrawerOpen] = useState(false);
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [isGoalDrawerOpen, setIsGoalDrawerOpen] = useState(false);
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

    const openTransactionDrawer = (id?: string) => {
        setEditingTransactionId(id || null);
        setIsTransactionDrawerOpen(true);
    };

    const closeTransactionDrawer = () => {
        setIsTransactionDrawerOpen(false);
        setEditingTransactionId(null);
    };

    const openCategoryDrawer = (id?: string) => {
        setEditingCategoryId(id || null);
        setIsCategoryDrawerOpen(true);
    };

    const closeCategoryDrawer = () => {
        setIsCategoryDrawerOpen(false);
        setEditingCategoryId(null);
    };

    const openGoalDrawer = (id?: string) => {
        setEditingGoalId(id || null);
        setIsGoalDrawerOpen(true);
    };

    const closeGoalDrawer = () => {
        setIsGoalDrawerOpen(false);
        setEditingGoalId(null);
    };

    const openSettingsDrawer = () => setIsSettingsDrawerOpen(true);
    const closeSettingsDrawer = () => setIsSettingsDrawerOpen(false);

    return (
        <UIContext.Provider value={{
            isTransactionDrawerOpen,
            openTransactionDrawer,
            closeTransactionDrawer,
            editingTransactionId,
            isCategoryDrawerOpen,
            openCategoryDrawer,
            closeCategoryDrawer,
            editingCategoryId,
            isGoalDrawerOpen,
            openGoalDrawer,
            closeGoalDrawer,
            editingGoalId,
            isSettingsDrawerOpen,
            openSettingsDrawer,
            closeSettingsDrawer,
        }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const ctx = useContext(UIContext);
    if (!ctx) throw new Error('useUI must be used within UIProvider');
    return ctx;
}
