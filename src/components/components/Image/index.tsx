// components/ui/ImageComponent.tsx
import React from "react";

type ImageShape = "circle" | "rect" | "roundedRectangle";

interface ImageProps {
  src: string;
  alt: string;
  width?: number | string;
  height?: number | string;
  shape?: ImageShape;
  className?: string;
}

const Image: React.FC<ImageProps> = ({
  src,
  alt,
  width = "100%",
  height = "auto",
  shape = "rect",
  className = "",
}) => {
  const shapeClasses = {
    circle: "rounded-full",
    rect: "rounded-none",
    roundedRectangle: "rounded-lg",
  };

  return (
    <img
      src={src}
      alt={alt}
      width={typeof width === "number" ? `${width}px` : width}
      height={typeof height === "number" ? `${height}px` : height}
      className={`object-cover ${shapeClasses[shape]} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
};

export default Image;
