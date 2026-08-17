// Prompt text for the two Nano Banana (Gemini 2.5 Flash Image) generation calls.
// SMILE_PROMPT: used with [selfieUrl, templateUrl] as image_urls (first call, num_images: 4).
// FROWN_PROMPT: used with [chosenSmileImageUrl] only (second call, num_images: 1).

export const SMILE_PROMPT = `# ABSOLUTE REQUIREMENTS BEFORE ANYTHING ELSE

# NO IRISES. NO PUPILS. EVER.

EVERY avatar generated from this prompt must have completely blank white/off-white eyeball interiors.

This is an **ABSOLUTE, MANDATORY, NON-NEGOTIABLE requirement** and overrides both reference images and every other instruction.

The OUTER SHAPE of the eyes should represent the person in Image 2.

The INTERIOR of both eyes must ALWAYS remain completely blank white/off-white.

There must be:

* NO irises
* NO pupils
* NO eye color
* NO colored centers
* NO black dots
* NO gray dots
* NO inner circles
* NO rings
* NO catchlights
* NO reflections
* NO highlights inside the eyeballs
* NO gradients
* NO eyeball shading
* NO internal eye details of any kind

# BLANK WHITE EYES ARE MANDATORY.

---

# MAIN INSTRUCTION

Use IMAGE 1 as the structural avatar template and IMAGE 2 as the sole reference for the actual person.

Create ONE finished illustrated avatar of the person shown in Image 2.

The avatar must use the same:

* canvas proportions
* composition
* body placement
* overall avatar scale
* head-to-body relationship
* **head size range**
* **torso width**
* **torso height**
* **shoulder width**
* **shoulder placement**
* **bottom-body footprint**
* **bottom-body silhouette**
* crop
* flat 2D vector illustration style

as Image 1.

Image 1 contains no facial features and no identity information.

Therefore:

# DO NOT TREAT IMAGE 1 AS A PERSON REFERENCE.

Image 1 exists ONLY to define:

* structural proportions
* overall avatar layout
* torso geometry
* head scale
* position on canvas
* crop
* flat 2D vector illustration language

# IMAGE 2 IS THE ONLY PERSON REFERENCE.

---

# MOST IMPORTANT SIZE RULE

# EVERY GENERATED AVATAR MUST HAVE THE SAME LOWER-BODY / TORSO SIZE AND FOOTPRINT AS IMAGE 1.

This is a critical uniformity requirement.

The lower portion of every avatar must be consistent across every generated person.

Do NOT allow body type, clothing, gender presentation, hairstyle, accessories, or any other person-specific characteristic to change the size or silhouette of the torso.

The torso in Image 1 is not merely a style reference.

# IT IS THE EXACT SIZE AND SHAPE TEMPLATE FOR EVERY GENERATED AVATAR.

Every generated torso must occupy the same amount of canvas space as Image 1.

Every generated torso must have the same:

* total width
* total height
* shoulder width
* shoulder height
* shoulder curvature
* left outer edge
* right outer edge
* side curvature
* lower width
* bottom curvature
* bottom crop
* left bottom intersection
* right bottom intersection
* overall footprint

The lower body should look like the **same cutout shape reused every time**.

Only the clothing artwork inside that shape may change.

---

# GENERAL HEAD SIZE — KEEP UNIFORM

# THE GENERAL HEAD SIZE MUST ALSO REMAIN CONSISTENT WITH IMAGE 1.

Different people may have different:

* face shapes
* hairstyles
* hair volume
* hats
* headwear
* hair accessories

but the underlying head itself must remain within the same general scale as Image 1.

The head should NOT become:

* significantly larger
* significantly smaller
* much wider overall
* much taller overall
* disproportionately tiny
* disproportionately oversized

The actual facial silhouette may vary from person to person, but the face/head must still fit within the same general avatar scale.

Think of Image 1 as establishing a **HEAD-SIZE ENVELOPE**.

The person's actual face shape should vary inside that envelope.

Hair, hats, or accessories may extend beyond the base head shape when needed, but:

# THE UNDERLYING HEAD SCALE MUST REMAIN CONSISTENT.

Hair volume must NOT cause the actual face/head itself to become smaller.

A hat must NOT cause the head to shrink.

Short hair must NOT cause the head to become larger.

Long hair must NOT cause the head to become smaller.

The base head should remain approximately the same size and placement from avatar to avatar.

---

# SIZE CONSISTENCY RULE

Imagine generating 50 different people and placing all 50 avatar images in a grid.

The avatars should look like they were generated from the same character template.

Across every avatar:

* the bottom body should line up
* the shoulders should line up
* the torso widths should line up
* the bottom edges should line up
* the head centers should line up
* the general head scale should remain consistent
* only identity features should vary

Hair and headwear may create intentional differences around the head, but the underlying avatar proportions must remain stable.

# THE LOWER BODY MUST BE UNIFORM ACROSS ALL GENERATIONS.

---

# IMAGE 1 = STRUCTURE ONLY

Image 1 controls:

* canvas dimensions
* aspect ratio
* white background
* character placement
* overall avatar scale
* head-to-body proportion
* general head size
* general head placement
* neck placement
* shoulder placement
* torso width
* torso height
* torso silhouette
* shoulder-to-bottom silhouette
* bottom crop
* overall visual simplicity
* flat 2D vector style

Image 1 does NOT control:

* skin tone
* face shape
* facial features
* hair
* eyebrows
* eyes
* nose
* mouth
* teeth
* makeup
* clothing colors
* accessories

---

# IMAGE 2 = PERSON, IDENTITY, AND COLOR

Use Image 2 as the sole reference for:

* actual skin tone
* complexion
* face shape
* forehead shape
* cheek shape
* jaw shape
* chin shape
* outer eye shape
* eyebrow shape
* eyebrow thickness
* eyebrow color
* nose shape
* mouth size
* mouth width
* lip shape
* smile geometry
* visible teeth
* hairstyle
* hair silhouette
* hair length
* hair volume
* hairline
* hair part
* hair texture
* hair color
* facial hair
* freckles
* moles or beauty marks
* makeup
* eyelashes
* lip color
* clothing
* clothing colors
* jewelry
* glasses
* hats
* headwear
* hair accessories
* all other visible person-specific characteristics

---

# FLAT 2D VECTOR STYLE

The finished avatar must be rendered in a clean, flat, simplified **2D vector illustration style**.

Use:

* clean smooth shapes
* flat areas of color
* simple geometric forms
* simplified facial features
* minimal linework
* restrained shadow shapes
* restrained highlight shapes
* crisp edges
* polished editorial-avatar styling
* no photographic texture

Do NOT use:

* photorealism
* semi-realism
* painterly rendering
* 3D rendering
* realistic skin texture
* realistic pores
* realistic individual hair strands
* complex lighting
* photographic shadows
* background scenery
* highly detailed anatomy

The result should look like a professionally designed flat vector avatar.

---

# TORSO — EXACT SIZE AND SHAPE LOCK

# DO NOT REDESIGN THE TORSO.

Image 1 defines the exact torso geometry.

Treat the torso as a locked reusable component.

Preserve exactly:

* shoulder position
* shoulder width
* shoulder height
* shoulder curves
* left exterior torso edge
* right exterior torso edge
* torso width at every vertical level
* torso height
* side curvature
* lower torso width
* lower torso curvature
* bottom shape
* bottom crop
* exact location where the torso intersects the bottom edge
* total torso footprint on the canvas

# THE GENERATED TORSO MUST OCCUPY THE SAME PIXEL FOOTPRINT AS IMAGE 1 AS CLOSELY AS POSSIBLE.

Do NOT:

* widen the torso
* narrow the torso
* make it taller
* make it shorter
* move it upward
* move it downward
* reshape the shoulders
* change the side curves
* taper it differently
* make it more anatomical
* alter it based on body type
* alter it based on clothing
* alter it based on gender
* alter it based on age
* alter it based on pose

# TORSO GEOMETRY IS NOT PERSON-SPECIFIC.

Every person uses the same torso exterior.

---

# TORSO OVERLAY TEST

Before output, imagine placing the generated avatar directly over Image 1 at the exact same canvas size.

Ignore color and clothing details.

Compare ONLY the exterior torso.

The torso should align with Image 1 at:

* left shoulder
* right shoulder
* left side
* right side
* widest point
* lower left curve
* lower right curve
* bottom-left intersection
* bottom-right intersection

If the generated torso does not overlay Image 1 closely:

# THE TORSO IS INCORRECT.

Restore Image 1's torso geometry.

Do not output until the lower-body footprint matches.

---

# TORSO = FIXED CONTAINER

The torso is a fixed container.

Only modify artwork INSIDE it.

You may change:

* clothing color
* neckline
* collar
* lapels
* visible layers
* patterns
* graphics
* seams
* garment details

You may NOT change the exterior.

# CLOTHING MUST CONFORM TO THE TORSO.

# THE TORSO MUST NEVER CONFORM TO THE CLOTHING.

---

# HEAD SIZE — CONSISTENT TEMPLATE SCALE

Image 1 also establishes the general scale and location of the head.

The person's actual face shape may change, but the underlying head must remain close to Image 1 in:

* overall height
* overall width range
* center position
* vertical placement
* relationship to shoulders
* relationship to torso

# DO NOT SCALE THE HEAD BASED ON HAIR.

Hair is separate from the base head.

If Image 2 has huge hair:

Keep the base head the same general size and allow the hair to extend outward.

If Image 2 has very short hair:

Do not enlarge the face/head to fill the missing hair space.

If Image 2 has a hat:

Do not shrink the head to make room for the hat.

If Image 2 is bald:

Do not enlarge the head simply because no hair is present.

# BASE HEAD SCALE = IMAGE 1.

# FACE SHAPE = IMAGE 2.

# HAIR / HAT OUTER EXTENSION = IMAGE 2.

---

# COMPLETE IDENTITY REPLACEMENT

Image 1 contains no identity information.

Build the person entirely from Image 2.

Use Image 2 for:

* face shape
* hair
* eyebrows
* eyes
* nose
* mouth
* teeth
* skin
* makeup
* clothing
* accessories

while preserving Image 1's template proportions.

---

# FACE SHAPE — CUSTOM TO IMAGE 2

Build the person's facial silhouette from Image 2.

Use Image 2 to determine:

* forehead width
* forehead shape
* temple width
* face width
* face length
* cheekbone width
* cheek fullness
* jaw width
* jaw angle
* jaw taper
* chin width
* chin shape
* overall face contour

# EVERY PERSON SHOULD HAVE THEIR OWN FACE SHAPE.

However:

The face must remain inside approximately the same overall head-size envelope established by Image 1.

Do NOT let a round face become a dramatically larger head.

Do NOT let a narrow face become a dramatically smaller head.

Modify the shape within the consistent avatar scale.

---

# HAIR — COMPLETELY CUSTOM TO IMAGE 2

Build the hair entirely from Image 2.

Image 2 controls:

* hairstyle
* silhouette
* length
* width
* height
* volume
* hairline
* forehead exposure
* part
* bangs
* texture
* curls
* waves
* coils
* layers
* braids
* locs
* ponytail
* bun
* shaved areas
* baldness
* placement around ears
* placement around face
* placement around neck
* hair color

# HAIR IS PERSON-SPECIFIC.

The hair silhouette may vary substantially.

But:

# HAIR MUST NOT CHANGE THE BASE HEAD SIZE.

And:

# HAIR MUST NOT CHANGE THE TORSO SIZE OR POSITION.

If long hair overlaps the torso, draw it over the fixed torso.

Do not widen the torso to accommodate it.

---

# HAIR COLOR — IMAGE 2 ONLY

Use the actual apparent hair color from Image 2.

Do not use Image 1's gray as a hair color.

---

# EYEBROWS — CUSTOM TO IMAGE 2

Build the eyebrows entirely from Image 2.

Use Image 2 to determine:

* shape
* width
* thickness
* length
* arch
* angle
* curvature
* spacing
* placement
* taper
* asymmetry
* color

# EYEBROWS MUST BE INDIVIDUAL TO EACH PERSON.

---

# OUTER EYE SHAPE — IMAGE 2 ONLY

Use Image 2 to determine:

* eye width
* eye height
* roundness
* narrowness
* almond shape
* upper eyelid curvature
* lower eyelid curvature
* inner corner
* outer corner
* relative spacing

Keep the eye geometry person-specific while staying within the same general face scale.

---

# EYES — NO IRISES OR PUPILS

# BOTH EYEBALL INTERIORS MUST BE COMPLETELY BLANK WHITE/OFF-WHITE.

There must be:

* NO iris
* NO pupil
* NO eye color
* NO colored center
* NO dot
* NO circle
* NO ring
* NO iris outline
* NO pupil outline
* NO catchlight
* NO reflection
* NO highlight
* NO internal shading
* NO internal detail

# THE IRIS SHAPE ITSELF MUST NOT EXIST.

Outer eye shape = Image 2.

Eye interior = completely blank white/off-white.

---

# NOSE — IMAGE 2 ONLY

Use Image 2 to determine:

* bridge width
* bridge shape
* nose width
* nose length
* tip width
* tip shape
* nostril width
* overall recognizable geometry

Keep it simplified and person-specific.

---

# MOUTH — COMPLETELY CUSTOM TO IMAGE 2

Use Image 2 to determine:

* overall mouth size
* mouth width
* mouth height
* upper-lip shape
* lower-lip shape
* lip thickness
* cupid's bow
* smile width
* smile curvature
* corner position
* amount of visible teeth

# MOUTH SIZE AND WIDTH MUST BE PERSON-SPECIFIC.

Do not give every person the same standardized mouth.

---

# TEETH — COMPLETELY CUSTOM TO IMAGE 2

If teeth are clearly visible in Image 2, use Image 2 to determine:

* visible tooth-area width
* visible tooth-area height
* tooth contour
* front-tooth proportions
* relative front-tooth size
* spacing
* visible gaps
* alignment
* distinctive visible tooth characteristics

Keep teeth simplified.

If teeth are not clearly visible:

Use a simple neutral vector treatment.

---

# SKIN TONE — IMAGE 2 ONLY

Image 1's gray head is not a skin-color reference.

Use Image 2 to determine:

* skin depth
* lightness/darkness
* undertone
* complexion
* natural coloration

Do NOT:

* leave the skin gray
* desaturate it toward gray
* average with Image 1
* use a generic skin tone

# IMAGE 2 = SKIN COLOR.

---

# FRECKLES, MOLES, AND BEAUTY MARKS — IMAGE 2 ONLY

Include only when visibly present.

If no freckles are visible:

# ZERO FRECKLES.

---

# MAKEUP — IMAGE 2 ONLY

Use Image 2 to determine:

* blush
* mascara
* eyeliner
* eyeshadow
* lipstick
* lip tint
* brow makeup
* contour
* highlight

If not visible:

# DO NOT ADD IT.

---

# BLUSH AND ROSY CHEEKS — NATURAL ONLY

If Image 2 does not visibly show blush:

# NO BLUSH.

If blush is visible:

Represent it softly and naturally.

Never create:

* pink circles
* pink ovals
* red circles
* red ovals
* peach circles
* peach ovals
* hard-edged cheek patches
* sticker-like blush

Use soft diffuse skin-tone variation.

If natural blending cannot be achieved:

# OMIT THE BLUSH.

---

# EYELASHES AND EYE MAKEUP — IMAGE 2 ONLY

If Image 2 does not show prominent eyelashes:

**DO NOT ADD PROMINENT EYELASHES.**

If Image 2 does not show mascara:

**NO MASCARA.**

If Image 2 does not show eyeliner:

**NO EYELINER.**

If Image 2 does not show eyeshadow:

**NO EYESHADOW.**

---

# CLOTHING — IMAGE 2 DESIGN AND COLORS

Use Image 2 to determine:

* garment type
* garment colors
* neckline
* collar
* layers
* patterns
* graphics
* visible design details

# CLOTHING COLORS MUST COME FROM IMAGE 2.

Image 1's gray clothing is only a placeholder.

---

# CLOTHING MUST NOT ALTER THE TORSO

The clothing may change completely.

The torso geometry may not.

Even if Image 2 has:

* oversized clothing
* tight clothing
* a jacket
* a hoodie
* a coat
* a blazer
* a dress
* a sweater

the exterior torso remains exactly the same.

Represent those characteristics through internal design only.

---

# ACCESSORIES — IMAGE 2 ONLY

Use Image 2 to determine:

* glasses
* sunglasses
* earrings
* necklaces
* hats
* headwear
* hair accessories
* other visible accessories

Accessories around the head may extend beyond the base head envelope.

But:

# ACCESSORIES MUST NOT CHANGE THE BASE HEAD SCALE OR TORSO SCALE.

---

# REQUIRED UNIFORMITY CHECK

Before output, imagine placing this avatar beside several other avatars generated from the same template.

Check:

## LOWER BODY

Does the torso occupy the same width, height, and canvas footprint as Image 1?

If NO:

# CORRECT IT.

## SHOULDERS

Are the shoulders in the same location and the same width as Image 1?

If NO:

# CORRECT THEM.

## BOTTOM CROP

Does the lower torso meet the bottom of the canvas in the same places as Image 1?

If NO:

# CORRECT IT.

## HEAD SCALE

Ignoring hair, hats, and accessories, is the base head approximately the same size and location as Image 1?

If NO:

# CORRECT IT.

## PERSON-SPECIFIC FEATURES

Do the face shape, hair, eyebrows, eyes, nose, mouth, teeth, skin, and clothing genuinely reflect Image 2?

If NO:

# CORRECT THEM WITHOUT CHANGING THE TEMPLATE SCALE.

---

# REQUIRED OVERLAY TEST

Mentally overlay the output on top of Image 1.

# THE LOWER BODY SHOULD ALIGN.

The following should stay in approximately the same X/Y positions:

* neck center
* left shoulder
* right shoulder
* left torso edge
* right torso edge
* lower-left edge
* lower-right edge
* bottom intersections

The head center and general base head dimensions should also remain consistent.

Hair, hats, and accessories are allowed to extend outside the base head silhouette.

---

# FINAL PRIORITY ORDER

If anything conflicts:

**1. ABSOLUTE HIGHEST PRIORITY: NO IRISES OR PUPILS.**

**2. THE LOWER TORSO SIZE, SHAPE, POSITION, WIDTH, HEIGHT, SHOULDERS, AND BOTTOM CROP MUST MATCH IMAGE 1 ACROSS EVERY AVATAR.**

**3. THE BASE HEAD MUST REMAIN WITHIN THE SAME GENERAL SIZE AND PLACEMENT AS IMAGE 1.**

**4. IMAGE 2 controls skin tone and all person-specific colors.**

**5. IMAGE 2 controls face shape while remaining inside the consistent head-size envelope.**

**6. IMAGE 2 controls hair, hats, and accessories, which may extend beyond the base head silhouette but may not resize the base head or torso.**

**7. IMAGE 2 controls eyebrows, outer eye shape, nose, mouth, teeth, facial hair, makeup, clothing, and accessories.**

---

# MOST IMPORTANT CONCEPT

# IMAGE 1 = FIXED AVATAR SIZE TEMPLATE.

# IMAGE 2 = PERSON.

Every generated avatar must look like it came from the same pre-sized avatar template.

## FIXED ACROSS EVERY AVATAR:

**CANVAS + CHARACTER POSITION + HEAD-TO-BODY SCALE + GENERAL BASE HEAD SIZE + NECK POSITION + SHOULDER POSITION + SHOULDER WIDTH + TORSO WIDTH + TORSO HEIGHT + TORSO SILHOUETTE + BOTTOM CROP.**

## CUSTOM FOR EACH PERSON:

**FACE SHAPE + HAIR + HAIR COLOR + EYEBROWS + OUTER EYE SHAPE + NOSE + MOUTH + TEETH + SKIN TONE + FACIAL HAIR + MAKEUP + CLOTHING + CLOTHING COLORS + ACCESSORIES.**

# THE BOTTOM BODY MUST BE UNIFORM.

# THE BASE HEAD SIZE MUST BE UNIFORM.

# PERSON-SPECIFIC FEATURES MAY VARY INSIDE THAT SYSTEM.

---

# ABSOLUTE FINAL TORSO REQUIREMENT

# EVERY GENERATED AVATAR MUST USE THE SAME LOWER-BODY/TORSO FOOTPRINT AS IMAGE 1.

Same:

* width
* height
* shoulder placement
* shoulder width
* side curves
* lower width
* bottom curve
* bottom crop
* overall canvas footprint

# DO NOT GENERATE A NEW BODY SHAPE FOR EACH PERSON.

# REUSE THE SAME BODY TEMPLATE.

---

# ABSOLUTE FINAL HEAD-SIZE REQUIREMENT

# KEEP THE BASE HEAD APPROXIMATELY THE SAME SIZE AND POSITION AS IMAGE 1.

Face shape may vary.

Hair may vary.

Hats may vary.

Accessories may vary.

But the underlying head must not substantially grow or shrink.

# SAME BASE HEAD SCALE. DIFFERENT PERSON.

---

# ABSOLUTE FINAL SKIN REQUIREMENT

# SKIN COLOR MUST COME FROM IMAGE 2.

Do not leave the skin gray.

Do not use Image 1's gray as a skin reference.

---

# ABSOLUTE FINAL HAIR REQUIREMENT

# HAIR MUST COME COMPLETELY FROM IMAGE 2.

Hairstyle, silhouette, texture, placement, and color must reflect Image 2.

Hair may extend beyond the base head size.

It must not resize the base head or torso.

---

# ABSOLUTE FINAL FACE REQUIREMENT

# FACE SHAPE MUST COME FROM IMAGE 2.

Customize:

* forehead
* cheeks
* jaw
* chin
* face width
* face length
* overall facial contour

while keeping the base head within the uniform template scale.

---

# ABSOLUTE FINAL EYEBROW REQUIREMENT

# EYEBROWS MUST COME FROM IMAGE 2.

Shape, thickness, width, arch, angle, placement, spacing, taper, and color must be person-specific.

---

# ABSOLUTE FINAL MOUTH AND TEETH REQUIREMENT

# MOUTH AND TEETH MUST COME FROM IMAGE 2.

Mouth width, size, lip shape, smile geometry, and visible teeth must be person-specific.

---

# ABSOLUTE FINAL EYE REQUIREMENT

# NO IRISES. NO PUPILS. EVER.

Both eye interiors must be completely blank solid white/off-white.

NO IRISES.

NO PUPILS.

NO EYE COLOR.

NO DOTS.

NO CIRCLES.

NO RINGS.

NO INTERNAL EYE DETAILS WHATSOEVER.

If either eye contains an iris or pupil, the result is incorrect.

# BLANK WHITE EYES ARE MANDATORY.

Output ONE finished avatar only.

No text.

No labels.

No comparison panels.

No frames.

No borders.

No additional characters.`;

export const FROWN_PROMPT = `Make the exact same image, but make the eyes closed and the mouth frowning. Do not change any other part of the image.`;
