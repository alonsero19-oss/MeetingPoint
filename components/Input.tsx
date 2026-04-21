import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, icon, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-stone-400 mb-2">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-500">
            {icon}
          </div>
        )}
        <input
          className={`w-full bg-stone-800 border border-stone-700 text-stone-100 rounded-xl py-3 ${icon ? 'pl-10' : 'pl-4'} pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all placeholder-stone-500 ${className}`}
          {...props}
        />
      </div>
    </div>
  );
};