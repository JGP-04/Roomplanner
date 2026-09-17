import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Eye,
  House,
  Instagram,
  Layers3,
  MessageCircle,
  Ruler,
} from "lucide-react";

export interface NavigationItem {
  readonly label: string;
  readonly href: `#${string}`;
}

export interface ProcessStep {
  readonly number: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
}

export interface AudienceProfile {
  readonly kicker: string;
  readonly title: string;
  readonly description: string;
  readonly points: readonly string[];
  readonly icon: LucideIcon;
}

export interface SocialChannel {
  readonly name: string;
  readonly handle: string;
  readonly href: string | null;
  readonly icon: LucideIcon;
}

export const navigation: readonly NavigationItem[] = [
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Para quién", href: "#para-quien" },
  { label: "Visión", href: "#vision" },
  { label: "Contacto", href: "#contacto" },
];

export const processSteps: readonly ProcessStep[] = [
  {
    number: "01",
    title: "Define tu espacio",
    description:
      "Parte de las medidas, necesidades y sensaciones que quieres lograr. La buena planificación empieza por escuchar cómo vives.",
    icon: Ruler,
  },
  {
    number: "02",
    title: "Explora posibilidades",
    description:
      "Compara distribuciones, materiales y estilos en un mismo lugar, con decisiones visuales más claras y menos incertidumbre.",
    icon: Layers3,
  },
  {
    number: "03",
    title: "Visualiza y comparte",
    description:
      "Comunica una idea de forma comprensible antes de ejecutarla y alinea a todas las personas que participan del proyecto.",
    icon: Eye,
  },
];

export const audienceProfiles: readonly AudienceProfile[] = [
  {
    kicker: "Para quienes habitan",
    title: "Decidir con más confianza.",
    description:
      "ROOMPLANNR busca convertir ideas sueltas en una visión clara del espacio que quieres construir o renovar.",
    points: [
      "Ordena referencias y necesidades",
      "Entiende mejor cada alternativa",
      "Comparte tu visión con profesionales",
    ],
    icon: House,
  },
  {
    kicker: "Para quienes diseñan",
    title: "Comunicar con más precisión.",
    description:
      "Una futura herramienta de trabajo para presentar propuestas, iterar y hacer que cada decisión sea fácil de comprender.",
    points: [
      "Presenta conceptos con claridad",
      "Acelera conversaciones y revisiones",
      "Centraliza la evolución del proyecto",
    ],
    icon: BriefcaseBusiness,
  },
];

export const socialChannels: readonly SocialChannel[] = [
  {
    name: "Instagram",
    handle: "Inspiración, avances y novedades",
    href: null,
    icon: Instagram,
  },
  {
    name: "WhatsApp",
    handle: "Un canal directo, próximamente",
    href: null,
    icon: MessageCircle,
  },
];
