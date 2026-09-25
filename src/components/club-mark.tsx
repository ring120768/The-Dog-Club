import { PawPrint,Dog,Heart,Sparkles } from "lucide-react";
export function ClubMark({emblem="paw",size=32}:{emblem?:string;size?:number}) {const Icon=({paw:PawPrint,dog:Dog,heart:Heart,sparkles:Sparkles})[emblem]??PawPrint;return <Icon size={size} aria-hidden="true"/>;}
