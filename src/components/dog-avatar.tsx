"use client";
import Image from "next/image";
import { useState } from "react";
import { Dog } from "lucide-react";
export function DogAvatar({
  colour = "sand",
  large = false,
  photoSrc,
  name = "Dog",
}: {
  colour?: string;
  large?: boolean;
  photoSrc?: string;
  name?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const showPhoto = photoSrc && failedSrc !== photoSrc;
  return (
    <div className={`dog-avatar ${colour} ${large ? "large" : ""}`}>
      {showPhoto ? (
        <Image
          src={photoSrc}
          alt={`${name}’s profile photo`}
          fill
          sizes={large ? "220px" : "156px"}
          unoptimized
          className="dog-photo"
          onError={() => setFailedSrc(photoSrc)}
        />
      ) : (
        <>
          <Dog
            size={large ? 92 : 58}
            strokeWidth={1.2}
            aria-label="Illustrated dog avatar"
          />
          <span className="spark" aria-hidden="true">
            ✦
          </span>
        </>
      )}
    </div>
  );
}
