import { z } from "zod";
export const palettes = [
 {name:"Woodland",value:"#235448"}, {name:"Coastal",value:"#2e526a"}, {name:"Plum",value:"#633c56"}, {name:"Terracotta",value:"#753f32"}, {name:"Charcoal",value:"#39463f"},
] as const;
export const brandInput=z.object({name:z.string().trim().min(1,"Give the club a name.").max(80),tagline:z.string().trim().min(1,"Add a welcome tagline.").max(160),location:z.string().trim().min(1,"Add a location label.").max(120),colour:z.enum(["#235448","#2e526a","#633c56","#753f32","#39463f"]),emblem:z.enum(["paw","dog","heart","sparkles"]),avatar_tone:z.enum(["sand","sage","rose"])});
export type BrandInput=z.infer<typeof brandInput>;
export const onboardingInput=brandInput.extend({slug:z.string().trim().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"Use lowercase letters, numbers and single hyphens for the club address."),managerEmail:z.email().max(254).transform(value=>value.toLowerCase())});
