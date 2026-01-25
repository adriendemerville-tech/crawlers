import { Helmet } from 'react-helmet-async';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { Book, Search, Zap, Globe, Brain, FileCode, Download, ExternalLink } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GlossaryTerm {
  term: string;
  acronym?: string;
  definition: string;
  category: 'seo' | 'geo' | 'performance' | 'technical' | 'ai';
  toolLink?: { path: string; label: string };
}

const glossaryTerms: Record<string, GlossaryTerm[]> = {
  fr: [
    // SEO Terms
    { term: "SEO", acronym: "Search Engine Optimization", definition: "Ensemble des techniques visant à améliorer le positionnement d'un site web dans les résultats des moteurs de recherche comme Google. L'objectif est d'augmenter la visibilité et le trafic organique.", category: "seo", toolLink: { path: "/audit-expert", label: "Testez avec l'Audit Expert" } },
    { term: "SERP", acronym: "Search Engine Results Page", definition: "Page de résultats affichée par un moteur de recherche après une requête. Elle contient les liens organiques, les annonces payantes et les fonctionnalités enrichies.", category: "seo" },
    { term: "Balise Title", definition: "Élément HTML qui définit le titre d'une page web. C'est le texte cliquable affiché dans les résultats de recherche. Idéalement moins de 60 caractères.", category: "seo", toolLink: { path: "/audit-expert", label: "Analysez vos balises" } },
    { term: "Meta Description", definition: "Court résumé de 150-160 caractères décrivant le contenu d'une page. Affichée sous le titre dans les SERP, elle influence le taux de clic.", category: "seo", toolLink: { path: "/audit-expert", label: "Vérifiez vos metas" } },
    { term: "Backlink", definition: "Lien entrant provenant d'un autre site web pointant vers le vôtre. Les backlinks de qualité améliorent l'autorité et le classement SEO.", category: "seo" },
    { term: "Mots-clés", definition: "Termes et expressions que les internautes tapent dans les moteurs de recherche. L'optimisation des mots-clés est fondamentale pour le référencement.", category: "seo" },
    { term: "Indexation", definition: "Processus par lequel les moteurs de recherche ajoutent les pages web à leur base de données. Une page non indexée n'apparaît pas dans les résultats.", category: "seo", toolLink: { path: "/?tab=crawlers", label: "Testez vos crawlers" } },
    { term: "Robots.txt", definition: "Fichier texte à la racine d'un site indiquant aux robots des moteurs de recherche quelles pages crawler ou ignorer.", category: "seo", toolLink: { path: "/?tab=crawlers", label: "Analysez votre robots.txt" } },
    { term: "Sitemap XML", definition: "Fichier listant toutes les URLs importantes d'un site pour faciliter leur découverte et indexation par les moteurs de recherche.", category: "seo" },
    { term: "Canonical URL", definition: "Balise HTML indiquant la version principale d'une page lorsque plusieurs URLs affichent un contenu similaire, évitant le contenu dupliqué.", category: "seo" },
    { term: "E-E-A-T", acronym: "Experience, Expertise, Authoritativeness, Trustworthiness", definition: "Critères de qualité utilisés par Google pour évaluer la fiabilité d'un contenu : Expérience, Expertise, Autorité et Fiabilité.", category: "seo", toolLink: { path: "/audit-expert", label: "Évaluez votre E-E-A-T" } },
    { term: "Rich Snippets", definition: "Résultats de recherche enrichis affichant des informations supplémentaires (étoiles, prix, images) grâce aux données structurées.", category: "seo" },
    { term: "Balises Hn", definition: "Hiérarchie de titres HTML (H1 à H6) structurant le contenu d'une page. Le H1 est le titre principal, les H2-H6 sont des sous-titres.", category: "seo", toolLink: { path: "/audit-expert", label: "Analysez vos H1-H6" } },
    { term: "Alt Text", definition: "Texte alternatif décrivant une image pour l'accessibilité et le SEO. Aide les moteurs de recherche à comprendre le contenu visuel.", category: "seo" },
    { term: "Anchor Text", definition: "Texte cliquable d'un lien hypertexte. Un anchor text descriptif améliore le SEO et l'expérience utilisateur.", category: "seo" },
    { term: "Crawl Budget", definition: "Nombre de pages qu'un moteur de recherche va explorer sur un site pendant une période donnée. Important pour les grands sites.", category: "seo", toolLink: { path: "/?tab=crawlers", label: "Optimisez votre crawl" } },
    { term: "Domain Authority", acronym: "DA", definition: "Score de 0 à 100 estimant la capacité d'un domaine à se positionner dans les résultats de recherche. Métrique développée par Moz.", category: "seo" },
    { term: "Nofollow", definition: "Attribut de lien indiquant aux moteurs de recherche de ne pas transmettre d'autorité SEO vers la page de destination.", category: "seo" },
    { term: "Long Tail Keywords", definition: "Mots-clés de longue traîne, expressions de 3+ mots plus spécifiques et moins concurrentiels, souvent à meilleur taux de conversion.", category: "seo" },
    { term: "Featured Snippet", definition: "Encadré affiché en position zéro des résultats Google, répondant directement à une question de l'utilisateur.", category: "seo" },
    
    // GEO Terms
    { term: "GEO", acronym: "Generative Engine Optimization", definition: "Optimisation pour les moteurs de recherche génératifs comme ChatGPT, Claude, Gemini et Perplexity. L'objectif est d'être cité dans les réponses IA.", category: "geo", toolLink: { path: "/?tab=geo", label: "Calculez votre score GEO" } },
    { term: "SGE", acronym: "Search Generative Experience", definition: "Expérience de recherche générative de Google intégrant des réponses générées par IA directement dans les résultats de recherche.", category: "geo", toolLink: { path: "/?tab=geo", label: "Préparez-vous pour SGE" } },
    { term: "LLM", acronym: "Large Language Model", definition: "Grand modèle de langage entraîné sur d'immenses corpus de textes, capable de comprendre et générer du langage naturel (GPT-4, Claude, Gemini).", category: "geo", toolLink: { path: "/?tab=llm", label: "Testez votre visibilité LLM" } },
    { term: "Crawler IA", definition: "Robot d'exploration utilisé par les entreprises d'IA pour collecter des données web et entraîner leurs modèles de langage.", category: "geo", toolLink: { path: "/?tab=crawlers", label: "Détectez les crawlers IA" } },
    { term: "GPTBot", definition: "Crawler d'OpenAI collectant des données pour entraîner les modèles GPT. Peut être bloqué ou autorisé via robots.txt.", category: "geo", toolLink: { path: "/?tab=crawlers", label: "Vérifiez GPTBot" } },
    { term: "ClaudeBot", definition: "Crawler d'Anthropic collectant des données pour entraîner Claude. Respecte les directives robots.txt.", category: "geo", toolLink: { path: "/?tab=crawlers", label: "Vérifiez ClaudeBot" } },
    { term: "Citabilité", definition: "Capacité d'un contenu à être cité comme source par les modèles de langage dans leurs réponses. Dépend de la qualité et de la structure.", category: "geo", toolLink: { path: "/?tab=llm", label: "Mesurez votre citabilité" } },
    { term: "Hallucination IA", definition: "Erreur d'un LLM générant des informations fausses ou inventées présentées comme vraies. Problème majeur de fiabilité.", category: "geo" },
    { term: "Prompt", definition: "Instruction ou question envoyée à un modèle de langage pour obtenir une réponse. La qualité du prompt influence la qualité de la réponse.", category: "geo" },
    { term: "llms.txt", definition: "Fichier texte fournissant des informations structurées aux LLMs sur un site web, similaire au robots.txt pour les moteurs de recherche.", category: "geo", toolLink: { path: "/?tab=geo", label: "Optimisez pour les LLMs" } },
    { term: "Données Structurées", definition: "Balisage (JSON-LD, Schema.org) permettant aux moteurs et IA de mieux comprendre le contenu d'une page web.", category: "geo", toolLink: { path: "/?tab=geo", label: "Analysez vos données structurées" } },
    { term: "JSON-LD", acronym: "JavaScript Object Notation for Linked Data", definition: "Format de données structurées recommandé par Google, intégré dans le HTML pour décrire le contenu aux machines.", category: "geo" },
    { term: "Schema.org", definition: "Vocabulaire standardisé de données structurées créé par Google, Microsoft, Yahoo et Yandex pour baliser le contenu web.", category: "geo" },
    { term: "RAG", acronym: "Retrieval-Augmented Generation", definition: "Technique combinant recherche d'information et génération de texte pour améliorer la précision des réponses LLM.", category: "geo" },
    { term: "Token", definition: "Unité de base traitée par un LLM, correspondant approximativement à 4 caractères ou 0.75 mot en anglais.", category: "geo" },
    
    // Performance Terms
    { term: "Core Web Vitals", definition: "Métriques de performance web essentielles définies par Google : LCP, FID/INP et CLS. Facteur de classement SEO.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Mesurez vos Core Web Vitals" } },
    { term: "LCP", acronym: "Largest Contentful Paint", definition: "Temps de chargement du plus grand élément visible (image, texte). Objectif : moins de 2.5 secondes.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Analysez votre LCP" } },
    { term: "FID", acronym: "First Input Delay", definition: "Délai entre la première interaction utilisateur et la réponse du navigateur. Objectif : moins de 100 ms. Remplacé par INP.", category: "performance" },
    { term: "INP", acronym: "Interaction to Next Paint", definition: "Nouvelle métrique Core Web Vitals mesurant la réactivité globale aux interactions. Remplace FID depuis mars 2024.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Testez votre INP" } },
    { term: "CLS", acronym: "Cumulative Layout Shift", definition: "Score mesurant la stabilité visuelle d'une page (éléments qui bougent pendant le chargement). Objectif : moins de 0.1.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Vérifiez votre CLS" } },
    { term: "FCP", acronym: "First Contentful Paint", definition: "Temps avant l'affichage du premier élément de contenu (texte ou image). Indicateur de vitesse perçue.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Mesurez votre FCP" } },
    { term: "TTFB", acronym: "Time To First Byte", definition: "Temps entre la requête HTTP et la réception du premier octet de réponse du serveur. Indicateur de performance serveur.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Analysez votre TTFB" } },
    { term: "TTI", acronym: "Time To Interactive", definition: "Temps nécessaire pour qu'une page devienne entièrement interactive et réponde aux actions utilisateur.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Testez votre TTI" } },
    { term: "TBT", acronym: "Total Blocking Time", definition: "Temps total pendant lequel le thread principal est bloqué, empêchant les interactions utilisateur.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Optimisez votre TBT" } },
    { term: "Speed Index", definition: "Métrique mesurant la vitesse à laquelle le contenu visible est progressivement affiché pendant le chargement.", category: "performance", toolLink: { path: "/?tab=pagespeed", label: "Calculez votre Speed Index" } },
    { term: "Lazy Loading", definition: "Technique chargeant les images et ressources uniquement lorsqu'elles deviennent visibles à l'écran, améliorant les performances.", category: "performance" },
    { term: "CDN", acronym: "Content Delivery Network", definition: "Réseau de serveurs distribués géographiquement pour livrer le contenu plus rapidement aux utilisateurs.", category: "performance" },
    { term: "Minification", definition: "Réduction de la taille des fichiers CSS, JavaScript et HTML en supprimant espaces, commentaires et caractères inutiles.", category: "performance" },
    { term: "Compression Gzip", definition: "Algorithme de compression réduisant la taille des fichiers transférés entre serveur et navigateur.", category: "performance" },
    { term: "Cache", definition: "Stockage temporaire de ressources pour accélérer les chargements ultérieurs en évitant de retélécharger les fichiers.", category: "performance" },
    { term: "Render Blocking", definition: "Ressources (CSS, JS) bloquant l'affichage de la page jusqu'à leur chargement complet. À optimiser pour la performance.", category: "performance" },
    { term: "Above the Fold", definition: "Contenu visible sans défilement lors du chargement initial. Doit être optimisé en priorité pour l'expérience utilisateur.", category: "performance" },
    { term: "Critical CSS", definition: "CSS minimum nécessaire pour afficher le contenu visible initialement, intégré en ligne pour accélérer le rendu.", category: "performance" },
    { term: "Preload", definition: "Directive indiquant au navigateur de charger une ressource en priorité, avant qu'elle ne soit découverte dans le HTML.", category: "performance" },
    { term: "WebP", definition: "Format d'image moderne offrant une meilleure compression que JPEG/PNG, recommandé pour optimiser les performances.", category: "performance" },
    
    // Technical Terms
    { term: "HTTPS", acronym: "HyperText Transfer Protocol Secure", definition: "Protocole de communication sécurisé utilisant le chiffrement SSL/TLS. Obligatoire pour le SEO et la confiance utilisateur.", category: "technical" },
    { term: "SSL/TLS", definition: "Protocoles de sécurité chiffrant les communications entre navigateur et serveur. Base du HTTPS.", category: "technical" },
    { term: "HTTP Status Codes", definition: "Codes de réponse serveur : 200 (OK), 301 (redirection permanente), 404 (non trouvé), 500 (erreur serveur).", category: "technical" },
    { term: "301 Redirect", definition: "Redirection permanente transférant le SEO de l'ancienne URL vers la nouvelle. À utiliser lors de changements d'URL.", category: "technical" },
    { term: "404 Error", definition: "Erreur indiquant qu'une page n'existe pas. Trop d'erreurs 404 nuisent au SEO et à l'expérience utilisateur.", category: "technical" },
    { term: "Responsive Design", definition: "Conception web adaptant automatiquement l'affichage à la taille de l'écran (mobile, tablette, desktop).", category: "technical" },
    { term: "Mobile-First", definition: "Approche de conception priorisant l'expérience mobile avant le desktop. Google utilise l'indexation mobile-first.", category: "technical" },
    { term: "AMP", acronym: "Accelerated Mobile Pages", definition: "Framework de pages mobiles ultra-rapides développé par Google. Moins utilisé depuis l'amélioration des Core Web Vitals.", category: "technical" },
    { term: "PWA", acronym: "Progressive Web App", definition: "Application web progressive offrant une expérience proche d'une app native : offline, notifications, installation.", category: "technical" },
    { term: "SSR", acronym: "Server-Side Rendering", definition: "Rendu côté serveur générant le HTML complet avant envoi au navigateur. Meilleur pour le SEO que le rendu client.", category: "technical" },
    { term: "CSR", acronym: "Client-Side Rendering", definition: "Rendu côté client où JavaScript génère le contenu dans le navigateur. Peut poser des problèmes d'indexation.", category: "technical" },
    { term: "Hreflang", definition: "Attribut HTML indiquant la langue et la région ciblée d'une page, essentiel pour le SEO international.", category: "technical" },
    { term: "Open Graph", definition: "Protocole de métadonnées définissant comment une page apparaît lorsqu'elle est partagée sur les réseaux sociaux.", category: "technical" },
    { term: "Twitter Cards", definition: "Balises meta permettant de personnaliser l'aperçu d'un lien partagé sur Twitter/X.", category: "technical" },
    { term: "API", acronym: "Application Programming Interface", definition: "Interface permettant à des applications de communiquer entre elles. PageSpeed Insights expose une API pour les audits.", category: "technical" },
    
    // AI Terms
    { term: "Intelligence Artificielle", acronym: "IA", definition: "Technologie permettant aux machines d'effectuer des tâches nécessitant normalement l'intelligence humaine.", category: "ai" },
    { term: "Machine Learning", definition: "Sous-domaine de l'IA où les algorithmes apprennent à partir de données sans être explicitement programmés.", category: "ai" },
    { term: "Deep Learning", definition: "Technique de machine learning utilisant des réseaux de neurones profonds pour traiter des données complexes.", category: "ai" },
    { term: "NLP", acronym: "Natural Language Processing", definition: "Traitement automatique du langage naturel permettant aux machines de comprendre et générer du texte humain.", category: "ai" },
    { term: "GPT", acronym: "Generative Pre-trained Transformer", definition: "Architecture de modèle de langage d'OpenAI, base de ChatGPT. Génère du texte de manière autoregressive.", category: "ai" },
    { term: "Transformer", definition: "Architecture de réseau de neurones révolutionnaire (2017) utilisant l'attention, base de tous les LLMs modernes.", category: "ai" },
    { term: "Fine-tuning", definition: "Processus d'adaptation d'un modèle pré-entraîné à une tâche spécifique avec des données supplémentaires.", category: "ai" },
    { term: "Embedding", definition: "Représentation vectorielle dense d'un texte capturant sa signification sémantique, utilisée pour la recherche et la similarité.", category: "ai" },
    { term: "Vector Database", definition: "Base de données optimisée pour stocker et rechercher des embeddings, utilisée dans les systèmes RAG.", category: "ai" },
    { term: "Perplexity", definition: "Métrique mesurant la qualité d'un modèle de langage. Aussi le nom d'un moteur de recherche IA populaire.", category: "ai" },
  ],
  en: [
    // SEO Terms
    { term: "SEO", acronym: "Search Engine Optimization", definition: "Set of techniques to improve a website's position in search engine results like Google. The goal is to increase visibility and organic traffic.", category: "seo" },
    { term: "SERP", acronym: "Search Engine Results Page", definition: "Results page displayed by a search engine after a query. Contains organic links, paid ads, and rich features.", category: "seo" },
    { term: "Title Tag", definition: "HTML element defining a web page's title. It's the clickable text displayed in search results. Ideally under 60 characters.", category: "seo" },
    { term: "Meta Description", definition: "Short 150-160 character summary describing a page's content. Displayed under the title in SERPs, it influences click-through rate.", category: "seo" },
    { term: "Backlink", definition: "Incoming link from another website pointing to yours. Quality backlinks improve authority and SEO ranking.", category: "seo" },
    { term: "Keywords", definition: "Terms and phrases users type into search engines. Keyword optimization is fundamental to SEO.", category: "seo" },
    { term: "Indexing", definition: "Process by which search engines add web pages to their database. Non-indexed pages don't appear in results.", category: "seo" },
    { term: "Robots.txt", definition: "Text file at a site's root telling search engine bots which pages to crawl or ignore.", category: "seo" },
    { term: "XML Sitemap", definition: "File listing all important URLs of a site to facilitate their discovery and indexing by search engines.", category: "seo" },
    { term: "Canonical URL", definition: "HTML tag indicating the main version of a page when multiple URLs display similar content, avoiding duplicate content.", category: "seo" },
    { term: "E-E-A-T", acronym: "Experience, Expertise, Authoritativeness, Trustworthiness", definition: "Quality criteria used by Google to evaluate content reliability: Experience, Expertise, Authority, and Trust.", category: "seo" },
    { term: "Rich Snippets", definition: "Enhanced search results displaying additional information (stars, prices, images) thanks to structured data.", category: "seo" },
    
    // GEO Terms
    { term: "GEO", acronym: "Generative Engine Optimization", definition: "Optimization for generative search engines like ChatGPT, Claude, Gemini, and Perplexity. The goal is to be cited in AI responses.", category: "geo" },
    { term: "SGE", acronym: "Search Generative Experience", definition: "Google's generative search experience integrating AI-generated answers directly into search results.", category: "geo" },
    { term: "LLM", acronym: "Large Language Model", definition: "Large language model trained on massive text corpora, capable of understanding and generating natural language (GPT-4, Claude, Gemini).", category: "geo" },
    { term: "AI Crawler", definition: "Exploration robot used by AI companies to collect web data and train their language models.", category: "geo" },
    { term: "Citability", definition: "Ability of content to be cited as a source by language models in their responses. Depends on quality and structure.", category: "geo" },
    { term: "AI Hallucination", definition: "LLM error generating false or invented information presented as true. Major reliability issue.", category: "geo" },
    { term: "Structured Data", definition: "Markup (JSON-LD, Schema.org) enabling search engines and AI to better understand web page content.", category: "geo" },
    { term: "JSON-LD", acronym: "JavaScript Object Notation for Linked Data", definition: "Structured data format recommended by Google, embedded in HTML to describe content to machines.", category: "geo" },
    
    // Performance Terms
    { term: "Core Web Vitals", definition: "Essential web performance metrics defined by Google: LCP, FID/INP, and CLS. SEO ranking factor.", category: "performance" },
    { term: "LCP", acronym: "Largest Contentful Paint", definition: "Loading time of the largest visible element (image, text). Target: under 2.5 seconds.", category: "performance" },
    { term: "INP", acronym: "Interaction to Next Paint", definition: "New Core Web Vitals metric measuring overall responsiveness to interactions. Replaced FID in March 2024.", category: "performance" },
    { term: "CLS", acronym: "Cumulative Layout Shift", definition: "Score measuring visual stability of a page (elements moving during load). Target: under 0.1.", category: "performance" },
    { term: "FCP", acronym: "First Contentful Paint", definition: "Time before the first content element (text or image) is displayed. Perceived speed indicator.", category: "performance" },
    { term: "TTFB", acronym: "Time To First Byte", definition: "Time between HTTP request and receiving the first byte of server response. Server performance indicator.", category: "performance" },
    { term: "Lazy Loading", definition: "Technique loading images and resources only when they become visible on screen, improving performance.", category: "performance" },
    { term: "CDN", acronym: "Content Delivery Network", definition: "Network of geographically distributed servers to deliver content faster to users.", category: "performance" },
    
    // Technical Terms
    { term: "HTTPS", acronym: "HyperText Transfer Protocol Secure", definition: "Secure communication protocol using SSL/TLS encryption. Mandatory for SEO and user trust.", category: "technical" },
    { term: "301 Redirect", definition: "Permanent redirect transferring SEO from old URL to new. Use when changing URLs.", category: "technical" },
    { term: "Responsive Design", definition: "Web design automatically adapting display to screen size (mobile, tablet, desktop).", category: "technical" },
    { term: "Mobile-First", definition: "Design approach prioritizing mobile experience before desktop. Google uses mobile-first indexing.", category: "technical" },
    { term: "SSR", acronym: "Server-Side Rendering", definition: "Server-side rendering generating complete HTML before sending to browser. Better for SEO than client rendering.", category: "technical" },
    { term: "Hreflang", definition: "HTML attribute indicating the target language and region of a page, essential for international SEO.", category: "technical" },
    
    // AI Terms
    { term: "Artificial Intelligence", acronym: "AI", definition: "Technology enabling machines to perform tasks normally requiring human intelligence.", category: "ai" },
    { term: "Machine Learning", definition: "AI subdomain where algorithms learn from data without being explicitly programmed.", category: "ai" },
    { term: "NLP", acronym: "Natural Language Processing", definition: "Automatic processing of natural language enabling machines to understand and generate human text.", category: "ai" },
    { term: "GPT", acronym: "Generative Pre-trained Transformer", definition: "OpenAI's language model architecture, basis of ChatGPT. Generates text autoregressively.", category: "ai" },
    { term: "RAG", acronym: "Retrieval-Augmented Generation", definition: "Technique combining information retrieval and text generation to improve LLM response accuracy.", category: "ai" },
  ],
  es: [
    // SEO Terms
    { term: "SEO", acronym: "Search Engine Optimization", definition: "Conjunto de técnicas para mejorar el posicionamiento de un sitio web en los resultados de motores de búsqueda como Google.", category: "seo" },
    { term: "SERP", acronym: "Search Engine Results Page", definition: "Página de resultados mostrada por un motor de búsqueda. Contiene enlaces orgánicos, anuncios pagados y características enriquecidas.", category: "seo" },
    { term: "Etiqueta Title", definition: "Elemento HTML que define el título de una página web. Es el texto clickeable mostrado en los resultados de búsqueda.", category: "seo" },
    { term: "Meta Description", definition: "Resumen corto de 150-160 caracteres describiendo el contenido de una página. Influye en la tasa de clics.", category: "seo" },
    { term: "Backlink", definition: "Enlace entrante de otro sitio web que apunta al tuyo. Los backlinks de calidad mejoran la autoridad y el ranking SEO.", category: "seo" },
    { term: "Palabras Clave", definition: "Términos y expresiones que los usuarios escriben en los motores de búsqueda. La optimización de palabras clave es fundamental.", category: "seo" },
    { term: "Indexación", definition: "Proceso por el cual los motores de búsqueda agregan páginas web a su base de datos.", category: "seo" },
    { term: "Robots.txt", definition: "Archivo de texto en la raíz de un sitio que indica a los robots qué páginas rastrear o ignorar.", category: "seo" },
    { term: "Sitemap XML", definition: "Archivo que lista todas las URLs importantes de un sitio para facilitar su descubrimiento e indexación.", category: "seo" },
    { term: "E-E-A-T", acronym: "Experience, Expertise, Authoritativeness, Trustworthiness", definition: "Criterios de calidad usados por Google para evaluar la fiabilidad del contenido.", category: "seo" },
    
    // GEO Terms
    { term: "GEO", acronym: "Generative Engine Optimization", definition: "Optimización para motores de búsqueda generativos como ChatGPT, Claude, Gemini y Perplexity. El objetivo es ser citado en las respuestas IA.", category: "geo" },
    { term: "SGE", acronym: "Search Generative Experience", definition: "Experiencia de búsqueda generativa de Google integrando respuestas generadas por IA en los resultados de búsqueda.", category: "geo" },
    { term: "LLM", acronym: "Large Language Model", definition: "Gran modelo de lenguaje entrenado en enormes corpus de texto, capaz de entender y generar lenguaje natural.", category: "geo" },
    { term: "Crawler IA", definition: "Robot de exploración usado por empresas de IA para recopilar datos web y entrenar sus modelos de lenguaje.", category: "geo" },
    { term: "Citabilidad", definition: "Capacidad de un contenido de ser citado como fuente por los modelos de lenguaje en sus respuestas.", category: "geo" },
    { term: "Datos Estructurados", definition: "Marcado (JSON-LD, Schema.org) que permite a los motores e IA entender mejor el contenido de una página web.", category: "geo" },
    { term: "JSON-LD", acronym: "JavaScript Object Notation for Linked Data", definition: "Formato de datos estructurados recomendado por Google, integrado en HTML para describir contenido a las máquinas.", category: "geo" },
    
    // Performance Terms
    { term: "Core Web Vitals", definition: "Métricas esenciales de rendimiento web definidas por Google: LCP, FID/INP y CLS. Factor de ranking SEO.", category: "performance" },
    { term: "LCP", acronym: "Largest Contentful Paint", definition: "Tiempo de carga del elemento visible más grande. Objetivo: menos de 2.5 segundos.", category: "performance" },
    { term: "INP", acronym: "Interaction to Next Paint", definition: "Nueva métrica Core Web Vitals midiendo la capacidad de respuesta general a las interacciones.", category: "performance" },
    { term: "CLS", acronym: "Cumulative Layout Shift", definition: "Puntuación que mide la estabilidad visual de una página. Objetivo: menos de 0.1.", category: "performance" },
    { term: "Lazy Loading", definition: "Técnica que carga imágenes y recursos solo cuando se vuelven visibles en pantalla, mejorando el rendimiento.", category: "performance" },
    { term: "CDN", acronym: "Content Delivery Network", definition: "Red de servidores distribuidos geográficamente para entregar contenido más rápido a los usuarios.", category: "performance" },
    
    // Technical Terms
    { term: "HTTPS", acronym: "HyperText Transfer Protocol Secure", definition: "Protocolo de comunicación seguro usando cifrado SSL/TLS. Obligatorio para SEO y confianza del usuario.", category: "technical" },
    { term: "Diseño Responsivo", definition: "Diseño web que adapta automáticamente la visualización al tamaño de pantalla.", category: "technical" },
    { term: "Mobile-First", definition: "Enfoque de diseño priorizando la experiencia móvil. Google usa indexación mobile-first.", category: "technical" },
    { term: "SSR", acronym: "Server-Side Rendering", definition: "Renderizado del lado del servidor generando HTML completo antes de enviarlo al navegador.", category: "technical" },
    
    // AI Terms
    { term: "Inteligencia Artificial", acronym: "IA", definition: "Tecnología que permite a las máquinas realizar tareas que normalmente requieren inteligencia humana.", category: "ai" },
    { term: "Machine Learning", definition: "Subdominio de la IA donde los algoritmos aprenden de datos sin ser explícitamente programados.", category: "ai" },
    { term: "NLP", acronym: "Natural Language Processing", definition: "Procesamiento automático del lenguaje natural que permite a las máquinas entender y generar texto humano.", category: "ai" },
    { term: "GPT", acronym: "Generative Pre-trained Transformer", definition: "Arquitectura de modelo de lenguaje de OpenAI, base de ChatGPT.", category: "ai" },
  ],
};

const categoryConfig = {
  seo: { icon: Search, label: { fr: 'SEO', en: 'SEO', es: 'SEO' }, color: 'text-blue-500' },
  geo: { icon: Globe, label: { fr: 'GEO & IA', en: 'GEO & AI', es: 'GEO & IA' }, color: 'text-purple-500' },
  performance: { icon: Zap, label: { fr: 'Performance', en: 'Performance', es: 'Rendimiento' }, color: 'text-green-500' },
  technical: { icon: FileCode, label: { fr: 'Technique', en: 'Technical', es: 'Técnico' }, color: 'text-orange-500' },
  ai: { icon: Brain, label: { fr: 'Intelligence Artificielle', en: 'Artificial Intelligence', es: 'Inteligencia Artificial' }, color: 'text-pink-500' },
};

const pageContent = {
  fr: {
    title: "Lexique SEO, GEO & Performance 2026",
    metaTitle: "Lexique SEO, GEO & Performance 2026 - Définitions simples | Crawlers.fr",
    metaDescription: "Dictionnaire complet des termes SEO, GEO et Performance web. Définitions simples et claires des acronymes : LCP, CLS, LLM, SGE, E-E-A-T et plus. Référence 2026 pour la France.",
    intro: "Retrouvez toutes les définitions essentielles du référencement naturel, de l'optimisation pour les moteurs génératifs et de la performance web. Ce lexique 2026 est votre référence pour comprendre le SEO et le GEO en France.",
    searchPlaceholder: "Rechercher un terme...",
    termsCount: "termes définis",
    categories: "Catégories",
    allCategories: "Toutes les catégories",
    noResults: "Aucun terme trouvé pour cette recherche.",
    downloadPdf: "Télécharger le lexique PDF",
    pdfTitle: "Lexique SEO, GEO & Performance 2026",
    pdfSubtitle: "Référence complète pour la France et l'Europe",
  },
  en: {
    title: "SEO, GEO & Performance Glossary 2026",
    metaTitle: "SEO, GEO & Performance Glossary 2026 - Simple Definitions | Crawlers.fr",
    metaDescription: "Complete dictionary of SEO, GEO and web Performance terms. Simple and clear definitions of acronyms: LCP, CLS, LLM, SGE, E-E-A-T and more. 2026 reference for Great Britain and USA.",
    intro: "Find all essential definitions of search engine optimization, generative engine optimization and web performance. This 2026 glossary is your reference for understanding SEO and GEO in Great Britain and USA.",
    searchPlaceholder: "Search a term...",
    termsCount: "terms defined",
    categories: "Categories",
    allCategories: "All categories",
    noResults: "No terms found for this search.",
    downloadPdf: "Download PDF glossary",
    pdfTitle: "SEO, GEO & Performance Glossary 2026",
    pdfSubtitle: "Complete reference for Great Britain and USA",
  },
  es: {
    title: "Glosario SEO, GEO & Rendimiento 2026",
    metaTitle: "Glosario SEO, GEO & Rendimiento 2026 - Definiciones simples | Crawlers.fr",
    metaDescription: "Diccionario completo de términos SEO, GEO y Rendimiento web. Definiciones simples y claras de acrónimos: LCP, CLS, LLM, SGE, E-E-A-T y más. Referencia 2026 para España, México y Argentina.",
    intro: "Encuentra todas las definiciones esenciales del posicionamiento en buscadores, optimización para motores generativos y rendimiento web. Este glosario 2026 es tu referencia para entender SEO y GEO en España, México y Argentina.",
    searchPlaceholder: "Buscar un término...",
    termsCount: "términos definidos",
    categories: "Categorías",
    allCategories: "Todas las categorías",
    noResults: "No se encontraron términos para esta búsqueda.",
    downloadPdf: "Descargar glosario PDF",
    pdfTitle: "Glosario SEO, GEO & Rendimiento 2026",
    pdfSubtitle: "Referencia completa para España, México y Argentina",
  },
};

export default function Lexique() {
  const { language } = useLanguage();
  const content = pageContent[language];
  const terms = glossaryTerms[language] || glossaryTerms.fr;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const filteredTerms = useMemo(() => {
    return terms.filter(term => {
      const matchesSearch = searchQuery === '' || 
        term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (term.acronym && term.acronym.toLowerCase().includes(searchQuery.toLowerCase())) ||
        term.definition.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === null || term.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [terms, searchQuery, selectedCategory]);

  const groupedTerms = useMemo(() => {
    const grouped: Record<string, GlossaryTerm[]> = {};
    filteredTerms.forEach(term => {
      const firstLetter = term.term[0].toUpperCase();
      if (!grouped[firstLetter]) {
        grouped[firstLetter] = [];
      }
      grouped[firstLetter].push(term);
    });
    return grouped;
  }, [filteredTerms]);

  const sortedLetters = Object.keys(groupedTerms).sort();

  // PDF Generation function
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(124, 58, 237);
    doc.text(content.pdfTitle, 20, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(content.pdfSubtitle, 20, 35);
    doc.text(`crawlers.fr | ${terms.length} ${content.termsCount}`, 20, 42);
    
    // Category labels for PDF
    const categoryLabels: Record<string, Record<string, string>> = {
      seo: { fr: 'SEO', en: 'SEO', es: 'SEO' },
      geo: { fr: 'GEO & IA', en: 'GEO & AI', es: 'GEO & IA' },
      performance: { fr: 'Performance', en: 'Performance', es: 'Rendimiento' },
      technical: { fr: 'Technique', en: 'Technical', es: 'Técnico' },
      ai: { fr: 'IA', en: 'AI', es: 'IA' },
    };
    
    // Group terms by category for better organization
    const termsByCategory: Record<string, GlossaryTerm[]> = {};
    terms.forEach(term => {
      if (!termsByCategory[term.category]) {
        termsByCategory[term.category] = [];
      }
      termsByCategory[term.category].push(term);
    });
    
    let yPosition = 55;
    const pageHeight = doc.internal.pageSize.height;
    
    Object.entries(termsByCategory).forEach(([category, categoryTerms]) => {
      // Add category header
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(124, 58, 237);
      doc.text(categoryLabels[category]?.[language] || category.toUpperCase(), 20, yPosition);
      yPosition += 8;
      
      // Create table for this category
      const tableData = categoryTerms.map(term => [
        term.term + (term.acronym ? ` (${term.acronym})` : ''),
        term.definition.length > 150 ? term.definition.substring(0, 147) + '...' : term.definition
      ]);
      
      autoTable(doc, {
        startY: yPosition,
        head: [[
          language === 'fr' ? 'Terme' : language === 'es' ? 'Término' : 'Term',
          'Description'
        ]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [124, 58, 237], fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold' },
          1: { cellWidth: 130 }
        },
        margin: { left: 20, right: 20 },
        didDrawPage: () => {
          // Footer on each page
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text('Crawlers.fr - Lexique SEO, GEO & Performance 2026', 20, pageHeight - 10);
          doc.text(`${doc.getCurrentPageInfo().pageNumber}`, doc.internal.pageSize.width - 25, pageHeight - 10);
        }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 15;
    });
    
    doc.save(`lexique-seo-geo-performance-2026-${language}.pdf`);
  };

  // Generate JSON-LD for DefinedTermSet (optimized for SGE and LLMs)
  const jsonLdDefinedTermSet = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "name": content.title,
    "description": content.metaDescription,
    "url": `https://crawlers.fr/lexique?lang=${language}`,
    "inLanguage": language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-US',
    "hasDefinedTerm": terms.slice(0, 50).map(term => ({
      "@type": "DefinedTerm",
      "name": term.term,
      "description": term.definition,
      ...(term.acronym && { "alternateName": term.acronym }),
      "inDefinedTermSet": `https://crawlers.fr/lexique?lang=${language}`,
    })),
  };

  // FAQ Schema for common questions
  const jsonLdFAQ = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": language === 'fr' ? "Qu'est-ce que le SEO ?" : language === 'es' ? "¿Qué es el SEO?" : "What is SEO?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": terms.find(t => t.term === 'SEO')?.definition || '',
        }
      },
      {
        "@type": "Question",
        "name": language === 'fr' ? "Qu'est-ce que le GEO ?" : language === 'es' ? "¿Qué es el GEO?" : "What is GEO?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": terms.find(t => t.term === 'GEO')?.definition || '',
        }
      },
      {
        "@type": "Question",
        "name": language === 'fr' ? "Qu'est-ce que le LCP ?" : language === 'es' ? "¿Qué es el LCP?" : "What is LCP?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": terms.find(t => t.term === 'LCP')?.definition || '',
        }
      },
      {
        "@type": "Question",
        "name": language === 'fr' ? "Qu'est-ce que le SGE de Google ?" : language === 'es' ? "¿Qué es el SGE de Google?" : "What is Google SGE?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": terms.find(t => t.term === 'SGE')?.definition || '',
        }
      },
    ],
  };

  return (
    <>
      <Helmet>
        <title>{content.metaTitle}</title>
        <meta name="description" content={content.metaDescription} />
        <meta name="keywords" content="lexique SEO, glossaire GEO, définitions performance web, LCP, CLS, LLM, SGE, E-E-A-T, Core Web Vitals, 2026" />
        <link rel="canonical" href={`https://crawlers.fr/lexique?lang=${language}`} />
        <meta property="og:title" content={content.metaTitle} />
        <meta property="og:description" content={content.metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://crawlers.fr/lexique?lang=${language}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={content.metaTitle} />
        <meta name="twitter:description" content={content.metaDescription} />
        <script type="application/ld+json">{JSON.stringify(jsonLdDefinedTermSet)}</script>
        <script type="application/ld+json">{JSON.stringify(jsonLdFAQ)}</script>
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="mx-auto max-w-5xl px-4 py-12">
          {/* Hero Section */}
          <section className="mb-12 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <Book className="h-4 w-4 text-primary" />
              <span>{terms.length} {content.termsCount}</span>
            </div>
            
            <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              {content.title}
            </h1>
            
            <p className="mx-auto max-w-3xl text-lg text-muted-foreground mb-6">
              {content.intro}
            </p>
            
            {/* Download PDF Button */}
            <Button 
              onClick={generatePDF}
              size="lg"
              variant="hero"
              className="gap-3"
            >
              <Download className="h-5 w-5" />
              {content.downloadPdf}
            </Button>
          </section>

          {/* Search and Filters */}
          <section className="mb-8 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={content.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 pl-12 pr-4 text-base"
                aria-label={content.searchPlaceholder}
              />
            </div>
            
            {/* Category Filters */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  selectedCategory === null
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {content.allCategories}
              </button>
              {Object.entries(categoryConfig).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      selectedCategory === key
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {config.label[language]}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Terms List */}
          <section className="space-y-8">
            {sortedLetters.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">{content.noResults}</p>
            ) : (
              sortedLetters.map(letter => (
                <div key={letter} id={`letter-${letter}`}>
                  <h2 className="mb-4 text-2xl font-bold text-primary border-b border-border pb-2">
                    {letter}
                  </h2>
                  <dl className="space-y-4">
                    {groupedTerms[letter].map((term, index) => {
                      const config = categoryConfig[term.category];
                      const Icon = config.icon;
                      return (
                        <div 
                          key={`${term.term}-${index}`}
                          className="rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
                          id={term.term.toLowerCase().replace(/\s+/g, '-')}
                        >
                          <dt className="flex items-start gap-3 mb-2">
                            <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${config.color}`} />
                            <div className="flex-1">
                              <span className="text-lg font-semibold text-foreground">
                                {term.term}
                              </span>
                              {term.acronym && (
                                <span className="ml-2 text-sm text-muted-foreground">
                                  ({term.acronym})
                                </span>
                              )}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full bg-muted ${config.color}`}>
                              {config.label[language]}
                            </span>
                          </dt>
                          <dd className="ml-8 text-muted-foreground leading-relaxed">
                            {term.definition}
                          </dd>
                          {/* Internal tool link */}
                          {term.toolLink && (
                            <div className="ml-8 mt-3">
                              <Link 
                                to={term.toolLink.path}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                {term.toolLink.label}
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))
            )}
          </section>

          {/* Alphabet Navigation */}
          {sortedLetters.length > 0 && (
            <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50" aria-label="Navigation alphabétique">
              <div className="flex flex-wrap justify-center gap-1 rounded-full bg-card/95 backdrop-blur-sm border border-border px-4 py-2 shadow-lg max-w-[90vw]">
                {sortedLetters.map(letter => (
                  <a
                    key={letter}
                    href={`#letter-${letter}`}
                    className="w-7 h-7 flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                  >
                    {letter}
                  </a>
                ))}
              </div>
            </nav>
          )}
        </main>

        <Footer />
      </div>
    </>
  );
}
