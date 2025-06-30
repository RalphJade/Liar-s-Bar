import React, { useState } from 'react';
import clsx from 'clsx';
import RegisterForm from './RegisterForm';
import LoginForm from './LoginForm';

type Tab = 'login' | 'register';

/**
 * A container component that provides a tabbed interface for switching
 * between the Login and Register forms. It manages which tab is active.
 */
const AuthTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('login');

  const getTabClassName = (tabName: Tab) => clsx(
    'w-full py-3 text-center font-semibold cursor-pointer transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-50',
    {
      'bg-indigo-600 text-white': activeTab === tabName,
      'bg-gray-200 text-gray-700 hover:bg-gray-300': activeTab !== tabName,
    }
  );

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-lg shadow-xl overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex">
        <button
          className={clsx(getTabClassName('login'), 'rounded-tl-lg')}
          onClick={() => setActiveTab('login')}
          role="tab"
          aria-selected={activeTab === 'login'}
        >
          Login
        </button>
        <button
          className={clsx(getTabClassName('register'), 'rounded-tr-lg')}
          onClick={() => setActiveTab('register')}
          role="tab"
          aria-selected={activeTab === 'register'}
        >
          Registrar
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="p-6 sm:p-8">
        {activeTab === 'login' ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
};

export default AuthTabs;