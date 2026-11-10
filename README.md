# Personal Portfolio

## Overview

A Spanish-language personal portfolio built with HTML and CSS for a Programming IV laboratory assignment. The page presents Samuel Picado's student profile, skills, academic project descriptions, and contact information.

The original coursework connects the portfolio's AI and machine learning focus to an analysis of five job postings. That research describes career interests and employer requirements; the implementation in this repository is a static website.

## Features

- A single page with navigation to profile, skills, projects, and contact sections.
- A responsive layout using CSS Grid, Flexbox, and media queries.
- Skill cards, tool tags, and two academic project presentation cards.
- Email, LinkedIn, and GitHub contact links, plus a contact form interface.
- Smooth anchor scrolling and CSS visual effects.

## Technology

- HTML for page structure and Spanish-language content.
- CSS for layout, styling, and responsive behavior.
- Google Fonts for the Inter typeface and Unsplash for the hero image.

The page contains no JavaScript and needs no package installation or build step. Python, machine learning libraries, and AWS appear in the page's portfolio content and the coursework research; they are not website runtime dependencies.

The original README credits the design to this [Figma reference](https://www.figma.com/make/WEBg3CYPDoMJ56FU6m33SB/Implementar-instrucciones-del-archivo?p=f&t=bP6UCjbnzHARlRZ3-0).

## Getting started

Clone the repository and open `index.html` in a browser:

```bash
git clone https://github.com/samuelpicado/Laboratorio-1-Programacion-4.git
cd Laboratorio-1-Programacion-4
```

For an optional local HTTP preview, use Python 3 from the repository root:

```bash
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open <http://127.0.0.1:8000>. Keep `index.html` and `styles.css` together. An internet connection is needed to load the external font and hero image.

The contact form posts to `#` and has no receiving backend in this repository, so it does not deliver messages. The existing email link opens the visitor's configured mail application. Both project detail buttons currently use `#` placeholders.

## Repository layout

| Path | Purpose |
| --- | --- |
| `index.html` | Portfolio sections, project descriptions, and contact interface. |
| `styles.css` | Shared styles, components, animations, and responsive rules. |
| `README.md` | Project overview, setup, and the coursework research context. |

## Project status

Academic frontend project. The repository contains the portfolio page and styles; it does not include the machine learning implementations described in the project cards. Form delivery and project detail destinations remain unimplemented.

<details>
<summary>Original coursework research (Spanish)</summary>

# Ofertas de Trabajo:

# Primer oferta de trabajo:
https://www.linkedin.com/jobs/view/4376783134/
#1 Nombre del puesto

Mobile Application Developer

#2 Tecnologías requeridas

React Native

JavaScript

TypeScript

Swift

Objective-C

Kotlin

Java

Xcode

Android Studio

Gradle

Fastlane

CI/CD para aplicaciones móviles

Integración de SDKs nativos (pagos, mapas, autenticación, media)

Librerías nativas de terceros

APIs móviles

#3 Habilidades técnicas (Hard Skills)

Desarrollo de aplicaciones móviles en producción con React Native

Integración de código nativo iOS y Android

Creación de módulos nativos personalizados

Optimización de rendimiento, memoria y renderizado

Gestión del ciclo de vida de aplicaciones móviles

Manejo de tareas en segundo plano

Integración de SDKs nativos complejos

Soporte y gestión de pipelines de build y release

Debugging en entornos de producción

Conocimiento profundo de restricciones de rendimiento móvil

Experiencia con herramientas de monitoreo y crash reporting

Conocimientos de buenas prácticas de seguridad móvil

Nivel de inglés mínimo B2

#4 Habilidades blandas (Soft Skills)

Capacidad para participar en decisiones de arquitectura

Planificación técnica

Trabajo autónomo (modalidad contractor y remoto)

Resolución de problemas en producción

Comunicación efectiva en inglés

Adaptabilidad para trabajar con múltiples tecnologías

#5 Responsabilidades principales

Diseñar, construir y mantener aplicaciones móviles con React Native

Integrar código nativo en iOS y Android

Implementar funcionalidades móviles complejas

Optimizar rendimiento y estabilidad multiplataforma

Gestionar el ciclo de vida de la app y capacidades del dispositivo

Integrar librerías nativas y APIs externas

Apoyar procesos de build y release

Participar en decisiones arquitectónicas

Resolver errores en producción

# Segunda oferta de trabajo:
https://www.linkedin.com/jobs/view/4371308655
#1 Nombre del puesto

AI Engineer – Immediate Joiner (ASAP Start)
(Contrato de 1 año – remoto)

#2 Tecnologías requeridas

No se mencionan tecnologías específicas por nombre (como Python, TensorFlow, etc.), pero sí áreas tecnológicas claras:

Automatización para workflows de AI/ML

Model validation

AI agents

Continuous Integration (CI)

Frameworks de automatización

Herramientas de testing para AI

Plataformas con modelos de inteligencia artificial

Testing funcional, de integración y end-to-end

#3 Habilidades técnicas (Hard Skills)

Diseño y mantenimiento de frameworks de automatización para AI/ML

Automatización de evaluación de modelos y pipelines

Validación de rendimiento, precisión y drift de modelos de AI

Testing funcional, integración y end-to-end en sistemas con AI

Automatización de ejecución de pruebas y generación de reportes

Integración de agentes de AI en procesos de Quality Engineering (QE)

Evaluación de herramientas y frameworks de testing AI

Conocimiento en flujos de datos y validación de datasets

Familiaridad con estrategias de automatización en entornos CI

#4 Habilidades blandas (Soft Skills)

Trabajo colaborativo con equipos de Quality Engineering y liderazgo

Capacidad de investigación y evaluación tecnológica

Proactividad para proponer mejoras

Pensamiento analítico aplicado a calidad y confiabilidad

Adaptabilidad a entornos AI en expansión

Orientación a mejora continua

#5 Responsabilidades principales

Construir y mantener frameworks de automatización para AI/ML

Automatizar evaluación de outputs de modelos y pipelines

Integrar agentes de AI en procesos de Quality Engineering

Mejorar automatización en ejecución de pruebas y CI

Validar rendimiento y confiabilidad de modelos AI

Ejecutar pruebas funcionales, integración y end-to-end

Colaborar con QE engineers y liderazgo

Investigar y recomendar nuevas herramientas de testing AI

# Tercera oferta de trabajo
https://www.linkedin.com/jobs/view/4379948017
#1 Nombre del puesto

AWS Data Engineer

#2 Tecnologías requeridas

AWS

AWS Lambda

AWS Glue

SQL

Python

Data pipelines en la nube

Workflows de datos

#3 Habilidades técnicas (Hard Skills)

Diseño y desarrollo de data pipelines en AWS

Optimización de flujos de trabajo de datos en la nube

Escritura y mantenimiento de consultas SQL complejas

Extracción y transformación de datos (ETL)

Desarrollo de scripts y automatización en Python

Uso de servicios AWS como Lambda y Glue

Gestión de disponibilidad y calidad de datos

#4 Habilidades blandas (Soft Skills)

Capacidad para trabajar de forma independiente

Trabajo en equipo en entornos colaborativos

Comunicación con equipos multifuncionales

Orientación a la precisión y calidad de datos

Adaptabilidad a entornos cloud dinámicos

Mentalidad de aprendizaje continuo

#5 Responsabilidades principales

Diseñar, desarrollar y optimizar pipelines de datos en AWS

Escribir y mantener consultas SQL complejas

Automatizar procesos mediante Python

Colaborar con equipos para asegurar disponibilidad y exactitud de datos

Apoyar proyectos que utilicen servicios AWS como Lambda y Glue

# Cuarta oferta de trabajo
https://www.linkedin.com/jobs/view/4379910571
#1 Nombre del puesto

Software Engineer (Java)

#2 Tecnologías requeridas

Sistemas avanzados de AI

PowerPoint

Excel

Documentación estructurada

Herramientas de colaboración remota

Modelos analíticos y frameworks de consultoría

(No se mencionan tecnologías específicas de desarrollo en Java dentro de la descripción.)

#3 Habilidades técnicas (Hard Skills)

Descomposición estructurada de workflows de consultoría

Creación de task specifications y evaluation rubrics

Revisión y benchmarking de outputs generados por AI

Análisis de mercado (market sizing)

Análisis financiero y operativo

Investigación cualitativa

Identificación de fallas lógicas y debilidades en razonamiento

Síntesis ejecutiva de alto nivel

Creación de issue trees y modelos analíticos

Manejo avanzado de PowerPoint y Excel

Experiencia en consultoría estratégica (mínimo 2 años)

#4 Habilidades blandas (Soft Skills)

Pensamiento estructurado

Resolución de problemas basada en hipótesis

Trabajo autónomo

Gestión del tiempo en entorno remoto

Comunicación escrita excelente

Colaboración asincrónica

Atención al detalle

Orientación a calidad y estándares definidos

#5 Responsabilidades principales

Traducir workflows de consultoría en tareas estructuradas para sistemas AI

Revisar y evaluar outputs generados por AI

Crear ejemplos de referencia con estándares profesionales

Detectar fallas lógicas y documentar patrones de error

Colaborar con investigadores y otros contribuyentes

Entregar productos bajo estándares de calidad definidos

# Quinta oferta de trabajo
https://www.linkedin.com/jobs/view/4379710287
#1 Nombre del puesto

Machine Learning Engineer

#2 Tecnologías requeridas

Python

PyTorch

TensorFlow

MLOps

Pipelines de experimentación

Model deployment

Model monitoring

Data preprocessing

Feature engineering

Infraestructura escalable de Machine Learning

#3 Habilidades técnicas (Hard Skills)

Desarrollo y optimización de modelos de Machine Learning

Implementación de modelos en entornos productivos

Monitoreo y mantenimiento de modelos

Diseño de workflows MLOps

Preprocesamiento de datos

Ingeniería de características (feature engineering)

Construcción de pipelines de experimentación

Manejo avanzado de Python para ML

Trabajo con frameworks como PyTorch o TensorFlow

#4 Habilidades blandas (Soft Skills)

Comunicación escrita y verbal efectiva

Trabajo autónomo en entorno remoto

Gestión de tiempo y entregables

Adaptabilidad a distintos proyectos

Capacidad de colaborar con equipos distribuidos

#5 Responsabilidades principales

Desarrollar y optimizar modelos de Machine Learning

Implementar y desplegar modelos en entornos reales

Diseñar y mantener infraestructura ML escalable

Monitorear rendimiento y comportamiento de modelos

Trabajar en pipelines de experimentación y mejora continua

Colaborar con organizaciones mediante modalidad contractor

# Patrones comunes identificados

Del análisis de las cinco ofertas se identifican los siguientes patrones:

Fuerte enfoque en Inteligencia Artificial, Machine Learning y automatización.

Uso frecuente de Python y frameworks de ML (PyTorch, TensorFlow).

Importancia de infraestructura en la nube (especialmente AWS) y procesos de despliegue.

Relevancia de testing, validación, optimización y rendimiento.

Modalidad remota y contratación como independiente.

Alta valoración del trabajo autónomo y la comunicación efectiva en entornos distribuidos.

# Perfil profesional objetivo

Ingeniero de Sistemas especializado en Inteligencia Artificial y Machine Learning, con enfoque en desarrollo, automatización y despliegue de modelos en entornos cloud. Interesado en participar en proyectos remotos donde se integren programación, infraestructura y calidad para construir sistemas inteligentes robustos y escalables.

# Justificación del enfoque del sitio web

El sitio web fue desarrollado como una plataforma de postulación profesional orientada a posiciones en AI Engineering y Machine Learning. Su contenido destaca:

Proyectos relacionados con automatización y modelos de ML.

Uso de Python y herramientas de infraestructura en la nube.

Enfoque en calidad, validación y optimización de sistemas.

Este enfoque responde directamente a las tendencias actuales del mercado laboral tecnológico, caracterizadas por la alta demanda de perfiles especializados en AI, cloud y trabajo remoto.

# Diferenciadores clave

Integración de desarrollo de software, Machine Learning y aseguramiento de calidad en un mismo perfil técnico.

Enfoque en automatización, despliegue y escalabilidad, más allá del desarrollo teórico de modelos.

# Diseño hecho en Figma
 https://www.figma.com/make/WEBg3CYPDoMJ56FU6m33SB/Implementar-instrucciones-del-archivo?p=f&t=bP6UCjbnzHARlRZ3-0
</details>
