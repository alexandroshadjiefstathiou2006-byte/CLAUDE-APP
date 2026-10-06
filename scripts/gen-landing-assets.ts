/** Generates static illustration assets for the landing page. */
import { writeFileSync } from "fs";
import { renderAvatarSvg } from "@/server/render/svg";

writeFileSync("public/landing/creator-sofia.svg", renderAvatarSvg({ name: "Sofia", skinIndex: 1, hairColor: "brown", hairLength: "long", bg: ["#F4E9E1", "#E6CFC0"], outfit: "#16161A" }));
writeFileSync("public/landing/creator-marcus.svg", renderAvatarSvg({ name: "Marcus", skinIndex: 5, hairColor: "black", hairLength: "buzz", bg: ["#E7EBF2", "#C9D3E3"], outfit: "#16161A" }));
writeFileSync("public/landing/creator-maya.svg", renderAvatarSvg({ name: "Maya", skinIndex: 4, hairColor: "black", hairLength: "curly", bg: ["#EDE7F8", "#D3C6F2"], outfit: "#16161A" }));
