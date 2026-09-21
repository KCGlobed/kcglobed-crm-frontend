import React from 'react';

type TextVariant = 'heading' | 'subheading' | 'normal' | 'caption';

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children: React.ReactNode;
  variant?: TextVariant;
  className?: string;
}

const variantStyles: Record<TextVariant, string> = {
  heading: 'text-2xl font-bold',
  subheading: 'text-xl font-semibold',
  normal: 'text-base',
  caption: 'text-sm text-opacity-80',
};

const Text:React.FC<TextProps> = ({ children, variant = 'normal', className, ...props}) => {
  return (
    <p className={`${variantStyles[variant]} dark:text-white ${className}`} {...props}>
      {children}
    </p>
  );
}


export default Text;