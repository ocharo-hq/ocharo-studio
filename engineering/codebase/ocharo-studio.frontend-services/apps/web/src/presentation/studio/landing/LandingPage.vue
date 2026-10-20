<script setup lang="ts">
import { RouterLink } from "vue-router";
import { ArrowRight, Move, Palette, Save } from "@lucide/vue";
import { GARMENTS, MATERIALS } from "../../../domain/studio/catalog";
import BuildIdentity from "../../common/BuildIdentity.vue";
import StudioBrand from "../../common/StudioBrand.vue";
import GarmentGlyph from "../GarmentGlyph.vue";
import "./LandingPage.css";

/** Static, accessible introduction to the Ocharo design workflow, outside the operator frame, on the Ocharo theme. */
defineOptions({ name: "LandingPage" });

const featuredIds = new Set([
  "catalogue-scarf-red-paisley",
  "catalogue-scarf-blue-paisley",
  "catalogue-beqasam-jewel-stripe",
  "catalogue-shoyi-monochrome-ikat",
  "catalogue-scarf-sand-garden",
  "catalogue-atlas-floral-jewel-ikat",
]);
const featuredMaterials = MATERIALS.filter((material) =>
  featuredIds.has(material.id),
);
</script>

<template>
  <div class="landing-page">
    <a class="landing-skip" href="#landing-main">Skip to content</a>
    <header class="landing-header">
      <div class="landing-brand"><StudioBrand href="/" /><BuildIdentity /></div>
      <nav aria-label="Landing page">
        <a href="#how-it-works">How it works</a><a href="#forms">Forms</a
        ><RouterLink class="landing-nav-cta" to="/studio"
          >Open studio <ArrowRight :size="15"
        /></RouterLink>
      </nav>
    </header>
    <main id="landing-main" tabindex="-1">
      <section class="landing-hero" aria-labelledby="landing-title">
        <div class="landing-hero-copy">
          <span class="landing-kicker">A DIGITAL TEXTILE ATELIER</span>
          <h1 id="landing-title">Tradition,<br /><em>reimagined.</em></h1>
          <p>
            A silhouette. A textile. Your own expression. Explore Uzbek-inspired
            clothing, one creative choice at a time.
          </p>
          <div class="landing-actions">
            <RouterLink class="landing-primary" to="/studio"
              >Open the studio <ArrowRight :size="18" /></RouterLink
            ><a class="landing-secondary" href="#how-it-works"
              >See how it works</a
            >
          </div>
          <small>Creative visualization on a fixed-size silhouette.</small>
        </div>
        <div class="landing-hero-art">
          <span class="landing-art-label">NIMCHA / 01</span
          ><img
            src="/assets/landing/nimcha.png"
            width="800"
            height="1000"
            fetchpriority="high"
            alt="A patterned nimcha shown on the Ocharo Studio silhouette"
          /><span class="landing-pattern-disc" aria-hidden="true" />
          <div class="landing-art-note">
            <b>Find the pattern's heart.</b
            ><span>Move its anchor across textile and garment.</span>
          </div>
        </div>
      </section>
      <section class="landing-intro" aria-label="Studio introduction">
        <span>FORM</span><i aria-hidden="true" /><span>TEXTILE</span
        ><i aria-hidden="true" /><span>PLACEMENT</span>
        <p>
          A focused space for visual design decisions before anything is made.
        </p>
      </section>
      <section
        id="how-it-works"
        class="landing-workflow"
        aria-labelledby="workflow-title"
      >
        <div class="landing-section-heading">
          <span class="landing-kicker">THREE CREATIVE MOVES</span>
          <h2 id="workflow-title">From silhouette to saved idea.</h2>
        </div>
        <ol>
          <li>
            <span class="landing-step-number">01</span
            ><Palette aria-hidden="true" />
            <h3>Choose</h3>
            <p>
              Start with a garment, select one of its parts, then apply an
              available textile.
            </p>
          </li>
          <li>
            <span class="landing-step-number">02</span
            ><Move aria-hidden="true" />
            <h3>Place</h3>
            <p>
              Set the textile and garment anchor points. Adjust rotation, scale,
              and position.
            </p>
          </li>
          <li>
            <span class="landing-step-number">03</span
            ><Save aria-hidden="true" />
            <h3>Keep</h3>
            <p>
              Save a look, make a new version, or export an editable design and
              preview image.
            </p>
          </li>
        </ol>
      </section>
      <section id="forms" class="landing-forms" aria-labelledby="forms-title">
        <div class="landing-section-heading">
          <span class="landing-kicker">FIVE STARTING POINTS</span>
          <h2 id="forms-title">A form for every direction.</h2>
          <p>Each garment has its own editable parts and built-in details.</p>
        </div>
        <div class="landing-form-grid">
          <article v-for="(garment, index) in GARMENTS" :key="garment.id">
            <span class="landing-form-index" aria-hidden="true"
              >0{{ index + 1 }}</span
            ><GarmentGlyph :id="garment.id" />
            <h3>{{ garment.name }}</h3>
            <span>{{ garment.subtitle }}</span>
            <p>{{ garment.description }}</p>
          </article>
        </div>
      </section>
      <section class="landing-materials" aria-labelledby="materials-title">
        <div class="landing-material-copy">
          <span class="landing-kicker">THE TEXTILE ROOM</span>
          <h2 id="materials-title">Pattern changes the whole expression.</h2>
          <p>
            Explore textile studies inspired by the Ocharo catalogue, from
            expressive ikat and paisley to quiet solid fabrics. Find the
            materials that belong with your chosen garment.
          </p>
          <RouterLink to="/studio"
            >Explore materials in studio <ArrowRight :size="16"
          /></RouterLink>
        </div>
        <div class="landing-material-grid">
          <figure v-for="material in featuredMaterials" :key="material.id">
            <img
              :src="material.textureUrl"
              alt=""
              width="1024"
              height="1024"
              loading="lazy"
              decoding="async"
            />
            <figcaption>
              <strong>{{ material.name }}</strong
              ><span>{{ material.family }}</span>
            </figcaption>
          </figure>
        </div>
      </section>
      <section class="landing-final-cta" aria-labelledby="final-cta-title">
        <span class="landing-kicker">MAKE IT YOURS</span>
        <h2 id="final-cta-title">Your next look begins with one choice.</h2>
        <p>Choose a form, follow a pattern, and see where it takes you.</p>
        <RouterLink class="landing-primary" to="/studio"
          >Open Ocharo Studio <ArrowRight :size="18"
        /></RouterLink>
      </section>
    </main>
    <footer class="landing-footer">
      <StudioBrand href="/" />
      <p>
        Uzbek-inspired clothing visualization for early creative exploration.
      </p>
      <RouterLink to="/studio">Enter studio</RouterLink>
    </footer>
  </div>
</template>
