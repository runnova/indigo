function onLoad(addon) {
  const { saveAddonData, getAddonData, getAllAddonData } = addon.persistence;

  const persistedRules = getAddonData('rules', []);

  const rules = Array.isArray(persistedRules)
    ? persistedRules.filter(
        rule =>
          rule &&
          typeof rule.prefix === 'string' &&
          rule.prefix.length > 0 &&
          typeof rule.base === 'string' &&
          typeof rule.enabled === 'boolean'
      )
    : [];

  const encoders = {
    base64: text => {
      const bytes = new TextEncoder().encode(text);
      let binary = '';

      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary);
    },
    hex: text =>
      Array.from(new TextEncoder().encode(text))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(''),
    binary: text =>
      Array.from(new TextEncoder().encode(text))
        .map(byte => byte.toString(2).padStart(8, '0'))
        .join(' '),
    uri: text => encodeURIComponent(text),
    uriComponent: text => encodeURIComponent(text),
    base64url: text => {
      const bytes = new TextEncoder().encode(text);
      let binary = '';

      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }

      return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    },
    reverse: text => Array.from(text).reverse().join(''),
    uppercase: text => text.toUpperCase(),
    lowercase: text => text.toLowerCase(),
  };

  const persistRules = () => saveAddonData('rules', rules);

  const ui = new addon.UIClass(addon.id);

  const prefixInput = ui.createInput('prefix-input', {
    label: 'Prefix',
    placeholder: 'e.g. b64:',
  });

  const baseInput = ui.createInput('base-input', {
    label: 'Encoding',
    placeholder: 'e.g. base64, hex, binary, uri, reverse, uppercase, lowercase, uriComponent, base64url',
  });

  const rulesList = ui.createList('rules-list', {
    label: `Encoding Rules (${rules.length})`,
    items: rules,
    onRemove: index => {
      rules.splice(index, 1);
      persistRules();
      rulesList.setItems([...rules]);
      updateRulesLabel();
    },
    renderItem: rule => ({
      type: 'text',
      content: `${rule.prefix} → ${rule.base} (${rule.enabled ? 'enabled' : 'disabled'})`,
    }),
  });

  const updateRulesLabel = () => {
    rulesList.setLabel(`Encoding Rules (${rules.length})`);
  };

  const addRule = (prefix, base) => {
    prefix = prefix.trim();
    base = base.trim().toLowerCase();

    if (!prefix || !base) {
      console.warn('[MessageEncoder] Prefix and encoding are required');
      return false;
    }

    if (!Object.hasOwn(encoders, base)) {
      console.warn(`[MessageEncoder] Unsupported encoding: "${base}"`);
      return false;
    }

    if (rules.some(rule => rule.prefix === prefix)) {
      console.warn(`[MessageEncoder] Prefix "${prefix}" already exists`);
      return false;
    }

    rules.push({ prefix, base, enabled: true });
    persistRules();
    rulesList.setItems([...rules]);
    updateRulesLabel();

    console.log(`[MessageEncoder] Added rule: "${prefix}" → ${base}`);
    return true;
  };

  addon.registerHook('message:before-send', messageData => {
    let content = messageData.content;

    if (typeof content !== 'string') {
      return messageData;
    }

    for (const rule of rules) {
      if (!rule.enabled || !content.startsWith(rule.prefix)) {
        continue;
      }

      const payload = content.slice(rule.prefix.length);

      try {
        content = encoders[rule.base](payload);
      } catch (error) {
        console.error(`[MessageEncoder] Encoding failed: ${rule.base}`, error);
      }

      break;
    }

    return {
      ...messageData,
      content,
    };
  });

  const addButton = ui.createButton('add-rule-btn', {
    label: '+ Add Rule',
    primary: true,
    onClick: () => {
      const prefix = prefixInput.value?.() ?? '';
      const base = baseInput.value?.() ?? '';

      if (addRule(prefix, base)) {
        prefixInput.setValue('');
        baseInput.setValue('');
      }
    },
  });

  const prefixSection = ui.createSection('input-section', {
    title: 'Add Encoding Rule',
    collapsible: false,
    children: [
      prefixInput,
      baseInput,
      addButton,
    ],
  });

  const rulesSection = ui.createSection('rules-section', {
    title: 'Current Rules',
    collapsible: false,
    children: [rulesList],
  });

  ui.createPanel({
    title: 'Message Encoder',
    description: 'Encode outgoing messages using configurable prefixes',
    elements: [prefixSection, rulesSection],
  });

  return {
    addRule,

    removeRule: prefix => {
      const index = rules.findIndex(rule => rule.prefix === prefix);

      if (index === -1) {
        return false;
      }

      rules.splice(index, 1);
      persistRules();
      rulesList.setItems([...rules]);
      updateRulesLabel();

      return true;
    },

    getRules: () => rules.map(rule => ({ ...rule })),

    clearRules: () => {
      rules.length = 0;
      persistRules();
      rulesList.setItems([]);
      updateRulesLabel();
    },

    getSupportedEncodings: () => Object.keys(encoders),

    getPersistedData: () => getAllAddonData(),
  };
}
