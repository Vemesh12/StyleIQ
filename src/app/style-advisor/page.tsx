'use client';

import { useState } from 'react';
import { Sparkles, UserCheck, Shirt } from 'lucide-react';
import { ProfileTab } from './profile-tab';
import { PickerTab } from './picker-tab';

export default function StyleAdvisorPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'picker'>('profile');

  return (
    <div className="w-full px-4 sm:px-8 lg:px-12 py-12 bg-slate-50 dark:bg-zinc-950 min-h-screen transition-colors duration-300">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/20 text-amber-900 dark:text-amber-400 text-sm font-semibold mb-3 shadow-2xs">
          <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          StyleIQ Intelligence Engine
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-3">
          Personal Style Advisor
        </h1>
        <p className="text-slate-600 dark:text-zinc-400 max-w-2xl mx-auto text-lg font-medium">
          Choose physical personalization rules or pick an item to get instant color harmony & outfit recommendations.
        </p>
      </div>

      {/* Navigation Tabs Switcher */}
      <div className="flex justify-center mb-10">
        <div className="p-1.5 bg-slate-200 dark:bg-zinc-900 rounded-2xl inline-flex gap-2 border border-slate-300 dark:border-zinc-800 shadow-inner">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            1. Physical Profile Advisor
          </button>

          <button
            onClick={() => setActiveTab('picker')}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-extrabold text-sm transition-all duration-200 cursor-pointer ${
              activeTab === 'picker'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Shirt className="w-4 h-4" />
            2. Item-Based Outfit Picker
          </button>
        </div>
      </div>

      {/* Both tabs stay mounted so switching doesn't lose what you entered. */}
      <div hidden={activeTab !== 'profile'}>
        <ProfileTab />
      </div>
      <div hidden={activeTab !== 'picker'}>
        <PickerTab />
      </div>
    </div>
  );
}
