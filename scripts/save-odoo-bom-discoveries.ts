#!/usr/bin/env node

import 'dotenv/config';
import * as discoveriesService from '../src/services/discoveries';

async function saveOdooBomDiscoveries() {
  console.log('Saving Odoo BoM flexibility discoveries...\n');

  try {
    // Discovery 1: Odoo BoM Flexibility Assessment
    console.log('1. Adding Odoo BoM Flexibility Assessment...');
    const d1 = await discoveriesService.addDiscovery({
      title: 'Odoo BoM Flexibility Limitations for Context-Based Variations',
      source: 'exploration',
      sourceDatabase: 'odoo',
      description:
        'Odoo native BoM system has limited flexibility for context-based variations. Key limitations: (1) No dynamic/runtime BoM modification without custom code, (2) "Apply on Variants" only works for predefined product variants, not infinite combinations, (3) No order-level context passing from Sales Orders to Manufacturing Orders, (4) Location-based rules work for physical location but not destination country/region, (5) For international orders with different component requirements, custom development is needed.',
      type: 'insight',
      priority: 4,
      tags: ['odoo', 'bom', 'manufacturing', 'flexibility', 'limitations'],
    });
    console.log(`   Created discovery ID: ${d1.id}\n`);

    // Discovery 2: Available Flexibility Mechanisms
    console.log('2. Adding Available Flexibility Mechanisms...');
    const d2 = await discoveriesService.addDiscovery({
      title: 'Odoo BoM Flexibility Mechanisms - What IS Possible Natively',
      source: 'exploration',
      sourceDatabase: 'odoo',
      tableName: 'mrp_bom',
      description:
        'What Odoo BoM flexibility IS possible natively: (1) operation_id field on mrp_bom_line links components to specific routing operations (conditional by manufacturing step), (2) Phantom BoM type enables virtual assemblies that consolidate sub-components (775 instances in SugarWish), (3) Variant-specific BoMs via mrp_bom.product_id override, (4) Flexible consumption settings (Blocked/Allowed/Allowed with Warning), (5) Manual Draft Manufacturing Order modification workflow for custom orders, (6) By-product management with cost allocation.',
      type: 'fact',
      priority: 3,
      tags: ['odoo', 'bom', 'manufacturing', 'flexibility', 'native-features'],
    });
    console.log(`   Created discovery ID: ${d2.id}\n`);

    // Discovery 3: SugarWish Current Implementation
    console.log('3. Adding SugarWish Current BoM Implementation...');
    const d3 = await discoveriesService.addDiscovery({
      title: 'SugarWish Odoo BoM Implementation - Seasonal Focus, No Dynamic Flexibility',
      source: 'exploration',
      sourceDatabase: 'odoo',
      description:
        'SugarWish uses standard Odoo BoM without custom extensions. Current implementation: (1) 2,078 total BoMs stored: 1,303 normal type + 775 phantom types, (2) MRP completion triggers automatic sync to SugarWish inventory system, (3) Seasonal variations handled manually via seasonal_kit column in buyer_products table, NOT via dynamic BoM switching, (4) No evidence of context-based flexible BoMs for international orders (different requirements by destination country/region).',
      type: 'fact',
      priority: 3,
      tags: ['sugarwish', 'odoo', 'bom', 'implementation', 'current-state'],
    });
    console.log(`   Created discovery ID: ${d3.id}\n`);

    // Discovery 4: Third-Party Solutions for Dynamic BoM
    console.log('4. Adding Third-Party Solutions for Dynamic BoM...');
    const d4 = await discoveriesService.addDiscovery({
      title: 'Third-Party Solutions for Dynamic BoM Flexibility in Odoo',
      source: 'exploration',
      sourceDatabase: 'odoo',
      description:
        'Options for enhanced Odoo BoM flexibility beyond native capabilities: (1) Steersman Dynamic BOM Generator module - uses attribute-value based component rules to generate 100K+ unique BoMs dynamically, (2) MRP Alternative Component module - enables alternate products with extra pricing/cost variations, (3) Custom module development - required for context-aware BoM selection based on order context (destination, shipping method, custom requirements).',
      type: 'insight',
      priority: 2,
      tags: ['odoo', 'bom', 'third-party', 'solutions', 'dynamic-flexibility'],
    });
    console.log(`   Created discovery ID: ${d4.id}\n`);

    console.log('✓ All discoveries saved successfully!\n');
    console.log('Summary:');
    console.log('- D1: Flexibility Assessment (ID: ' + d1.id.substring(0, 8) + ')');
    console.log('- D2: Native Mechanisms (ID: ' + d2.id.substring(0, 8) + ')');
    console.log('- D3: SugarWish Implementation (ID: ' + d3.id.substring(0, 8) + ')');
    console.log('- D4: Third-Party Solutions (ID: ' + d4.id.substring(0, 8) + ')');
  } catch (error) {
    console.error('Error saving discoveries:', error);
    process.exit(1);
  }
}

saveOdooBomDiscoveries();
