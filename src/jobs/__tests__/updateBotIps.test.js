const ipaddr = require('ipaddr.js');
const {
  processIpEntries,
  parseIpEntries,
  promoteSoftV4,
  promoteSoftV6,
  normalizeRanges,
  renderRange,
} = require('../updateBotIps');

describe('processIpEntries', () => {
  test('should process single IPv4 addresses', () => {
    const entries = ['192.168.1.1', '192.168.1.2'];
    const result = processIpEntries(entries);

    // Both addresses are in the same /24, so we should get a single /24 range
    expect(result).toHaveLength(1);
    expect(result[0].addr.toString()).toBe('192.168.1.0');
    expect(result[0].prefix).toBe(24);
  });

  test('should process single IPv6 addresses', () => {
    const entries = ['2001:db8::1', '2001:db8::2'];
    const result = processIpEntries(entries);

    // Both addresses are in the same /64, so we should get a single /64 range
    expect(result).toHaveLength(1);
    expect(result[0].addr.toString()).toBe('2001:db8::');
    expect(result[0].prefix).toBe(64);
  });

  test('should process CIDR ranges', () => {
    const entries = ['192.168.1.0/24', '2001:db8::/64'];
    const result = processIpEntries(entries);

    expect(result).toHaveLength(2);
    expect(result.some((r) => r.addr.toString() === '192.168.1.0' && r.prefix === 24)).toBe(true);
    expect(result.some((r) => r.addr.toString() === '2001:db8::' && r.prefix === 64)).toBe(true);
  });

  test('should promote IPv4 /32 to /24 when threshold exceeded', () => {
    // Create multiple /32 addresses in the same /24
    const entries = [];
    for (let i = 1; i <= 25; i += 1) {
      entries.push(`192.168.1.${i}`);
    }

    const result = processIpEntries(entries);

    // Should have one /24 instead of 25 /32
    const v4Ranges = result.filter((r) => r.addr.kind() === 'ipv4');
    const promoted = v4Ranges.find((r) => r.prefix === 24 && r.addr.toString() === '192.168.1.0');
    expect(promoted).toBeDefined();

    // Should not have individual /32 from that /24
    const individual = v4Ranges.filter(
      (r) => r.prefix === 32 && r.addr.toString().startsWith('192.168.1.'),
    );
    expect(individual).toHaveLength(0);
  });

  test('should promote IPv6 /128 to /64 when threshold exceeded', () => {
    // Create multiple /128 addresses in the same /64
    const entries = [];
    for (let i = 1; i <= 35; i += 1) {
      entries.push(`2001:db8::${i.toString(16)}`);
    }

    const result = processIpEntries(entries);

    // Should have one /64 instead of 35 /128
    const v6Ranges = result.filter((r) => r.addr.kind() === 'ipv6');
    const promoted = v6Ranges.find((r) => r.prefix === 64);
    expect(promoted).toBeDefined();

    // Should not have individual /128 from that /64
    const individual = v6Ranges.filter((r) => r.prefix === 128);
    expect(individual.length).toBe(0);
  });

  test('should remove duplicates', () => {
    // Use IPs from different /24 networks so they don't get aggregated
    const entries = ['192.168.1.1', '192.168.1.1', '192.168.2.1'];
    const result = processIpEntries(entries);

    const v4Ranges = result.filter((r) => r.addr.kind() === 'ipv4');
    // Should have 2 /24 ranges (192.168.1.0/24 and 192.168.2.0/24)
    expect(v4Ranges).toHaveLength(2);
  });

  test('should remove narrower ranges covered by broader ones', () => {
    const entries = ['192.168.1.0/24', '192.168.1.1/32'];
    const result = processIpEntries(entries);

    const v4Ranges = result.filter((r) => r.addr.kind() === 'ipv4');
    // Should only have /24, not /32
    const has24 = v4Ranges.some((r) => r.prefix === 24);
    const has32 = v4Ranges.some((r) => r.prefix === 32 && r.addr.toString() === '192.168.1.1');

    expect(has24).toBe(true);
    expect(has32).toBe(false);
  });

  test('should handle mixed IPv4 and IPv6', () => {
    const entries = ['192.168.1.1', '2001:db8::1', '10.0.0.1'];
    const result = processIpEntries(entries);

    const v4Ranges = result.filter((r) => r.addr.kind() === 'ipv4');
    const v6Ranges = result.filter((r) => r.addr.kind() === 'ipv6');

    expect(v4Ranges.length).toBeGreaterThan(0);
    expect(v6Ranges.length).toBeGreaterThan(0);
  });

  test('should reject invalid entries without crashing', () => {
    const entries = ['invalid-ip', '192.168.1.1', 'not-an-ip'];
    const result = processIpEntries(entries);

    // Should still process valid entries (192.168.1.1 becomes 192.168.1.0/24)
    const v4Ranges = result.filter((r) => r.addr.kind() === 'ipv4');
    expect(v4Ranges.some((r) => r.addr.toString() === '192.168.1.0' && r.prefix === 24)).toBe(true);
  });

  test('should handle empty input', () => {
    const result = processIpEntries([]);
    expect(result).toHaveLength(0);
  });

  test('should handle invalid CIDR prefix', () => {
    const entries = ['192.168.1.1/33', '2001:db8::1/129'];
    const result = processIpEntries(entries);

    // Should reject invalid prefixes
    expect(result).toHaveLength(0);
  });
});

describe('parseIpEntries', () => {
  test('should parse single IPv4 as /32', () => {
    const { softV4 } = parseIpEntries(['192.168.1.1']);
    expect(softV4).toHaveLength(1);
    expect(softV4[0].prefix).toBe(32);
    expect(softV4[0].addr.toString()).toBe('192.168.1.1');
  });

  test('should parse single IPv6 as /128', () => {
    const { softV6 } = parseIpEntries(['2001:db8::1']);
    expect(softV6).toHaveLength(1);
    expect(softV6[0].prefix).toBe(128);
    expect(softV6[0].addr.toString()).toBe('2001:db8::1');
  });

  test('should parse CIDR notation', () => {
    const { softV4 } = parseIpEntries(['192.168.1.0/24']);
    expect(softV4).toHaveLength(1);
    expect(softV4[0].prefix).toBe(24);
    expect(softV4[0].addr.toString()).toBe('192.168.1.0');
  });
});

describe('promoteSoftV4', () => {
  test('should promote when threshold met', () => {
    const entries = [];
    for (let i = 1; i <= 25; i += 1) {
      entries.push({ addr: ipaddr.parse(`192.168.1.${i}`), prefix: 32 });
    }

    const result = promoteSoftV4(entries);
    const promoted = result.find((r) => r.prefix === 24);
    expect(promoted).toBeDefined();
  });

  test('should always promote /32 to /24 regardless of count', () => {
    const entries = [];
    for (let i = 1; i <= 10; i += 1) {
      entries.push({ addr: ipaddr.parse(`192.168.1.${i}`), prefix: 32 });
    }

    const result = promoteSoftV4(entries);
    // Should always promote to /24, even with just a few IPs
    const promoted = result.find((r) => r.prefix === 24 && r.addr.toString() === '192.168.1.0');
    expect(promoted).toBeDefined();
    // Should not have individual /32 entries
    const individual = result.filter((r) => r.prefix === 32);
    expect(individual).toHaveLength(0);
  });
});

describe('normalizeRanges', () => {
  test('should remove duplicates', () => {
    const entries = [
      { addr: ipaddr.parse('192.168.1.1'), prefix: 32 },
      { addr: ipaddr.parse('192.168.1.1'), prefix: 32 },
    ];

    const result = normalizeRanges(entries);
    expect(result).toHaveLength(1);
  });

  test('should remove narrower ranges covered by broader', () => {
    const entries = [
      { addr: ipaddr.parse('192.168.1.0'), prefix: 24 },
      { addr: ipaddr.parse('192.168.1.1'), prefix: 32 },
    ];

    const result = normalizeRanges(entries);
    expect(result).toHaveLength(1);
    expect(result[0].prefix).toBe(24);
  });
});

describe('renderRange', () => {
  test('should render single IPv4 without prefix', () => {
    const entry = { addr: ipaddr.parse('192.168.1.1'), prefix: 32 };
    expect(renderRange(entry)).toBe('192.168.1.1');
  });

  test('should render CIDR with prefix', () => {
    const entry = { addr: ipaddr.parse('192.168.1.0'), prefix: 24 };
    expect(renderRange(entry)).toBe('192.168.1.0/24');
  });

  test('should render single IPv6 without prefix', () => {
    const entry = { addr: ipaddr.parse('2001:db8::1'), prefix: 128 };
    expect(renderRange(entry)).toBe('2001:db8::1');
  });
});
