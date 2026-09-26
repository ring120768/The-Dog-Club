export type RuntimeEnvironment = {
  DOGCLUB_LOCAL_DEMO?: string;
  NODE_ENV?: string;
};

export function isDemoMode(environment: RuntimeEnvironment = process.env) {
  return (
    environment.DOGCLUB_LOCAL_DEMO === "1" &&
    environment.NODE_ENV !== "production"
  );
}
