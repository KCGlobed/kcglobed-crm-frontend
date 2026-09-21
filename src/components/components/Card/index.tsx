import React from "react";
import Text from "../Text";

interface CardProps {
    img: string;
    title: string;
    desc: string;
    buttonText?: string;
    onButtonClick?: () => void;
}

const Card: React.FC<CardProps> = ({
    img,
    title,
    desc,
    buttonText,
    onButtonClick,
}) => {
    return (
        <div className="rounded-xl overflow-hidden shadow-lg transition-colors w-full max-w-sm border border-gray-200 dark:border-gray-700">
            <img src={img} alt={title} className="w-full h-48 object-cover" />
            <div className="p-4">
                <Text variant="heading">{title}</Text>
                <Text variant="normal" className="mt-2">{desc}</Text>
                {buttonText && <button
                    onClick={onButtonClick}
                    className="px-4 py-2 rounded text-white font-medium hover:opacity-90 transition">
                    {buttonText}
                </button>}
            </div>
        </div>
    );
};

export default Card;
