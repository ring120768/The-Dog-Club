import Image from "next/image";

/** Shared platform identity; operator emblems remain independently configurable. */
export function DemoLogo() {
  return (
    <Image
      className="demo-logo"
      src="/brand/demo-dog.jpg"
      alt=""
      width={96}
      height={72}
      sizes="96px"
    />
  );
}
