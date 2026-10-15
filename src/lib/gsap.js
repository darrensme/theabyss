import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { TextPlugin } from 'gsap/TextPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { RoughEase } from 'gsap/EasePack';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, SplitText, TextPlugin, ScrambleTextPlugin, RoughEase, useGSAP);

export { gsap, ScrollTrigger, SplitText, useGSAP };
