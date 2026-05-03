export function transformShopifyData(rawData: any) {
  const stripHtml = (html: string) => html ? html.replace(/<[^>]+>/g, '').trim() : '';

  // ── Shop details (REST shop.json) ─────────────────────────────────────────────
  const sd = rawData?.shopDetails || {};
  const shop_info = {
    email:            sd.email              || '',
    phone:            sd.phone              || '',
    currency:         sd.currency           || '',
    money_format:     sd.money_format       || '',
    timezone:         sd.iana_timezone      || '',
    plan:             sd.plan_name          || '',
    country:          sd.country_name       || '',
    province:         sd.province           || '',
    city:             sd.city               || '',
    address:          sd.address1           || '',
    zip:              sd.zip                || '',
    description:      sd.description        || '',
    myshopify_domain: sd.myshopify_domain   || '',
    weight_unit:      sd.weight_unit        || '',
    has_storefront:   sd.has_storefront     ?? false,
  };

  // ── Store stats ────────────────────────────────────────────────────────────────
  const stats = {
    customers_count: rawData?.customersCount ?? 0,
    orders_count:    rawData?.ordersCount    ?? 0,
  };

  // ── Native policies (REST) ────────────────────────────────────────────────────
  const native_policies: Record<string, string> = {};
  (rawData?.policies || []).forEach((policy: any) => {
    if (policy?.handle) native_policies[policy.handle] = stripHtml(policy.body || '');
  });

  // ── Custom pages (GraphQL) ────────────────────────────────────────────────────
  const custom_pages: Record<string, string> = {};
  rawData?.pages?.edges?.forEach((edge: any) => {
    const { handle, body } = edge.node;
    if (handle) custom_pages[handle] = stripHtml(body || '');
  });

  // ── Store context ─────────────────────────────────────────────────────────────
  const store_context = {
    name:   rawData?.shop?.name               || '',
    domain: rawData?.shop?.primaryDomain?.url  || '',
    shop_info,
    stats,
    native_policies,
    custom_pages,
  };

  // ── Collections (GraphQL) ─────────────────────────────────────────────────────
  const collections = rawData?.collections?.edges?.map((edge: any) => ({
    id:             edge.node.id,
    title:          edge.node.title,
    handle:         edge.node.handle,
    description:    edge.node.description || '',
    products_count: edge.node.productsCount?.count ?? 0,
    image:          edge.node.image?.url || null,
  })) || [];

  // ── Product catalog (GraphQL) ─────────────────────────────────────────────────
  const catalog = rawData?.products?.edges?.map((edge: any) => {
    const node = edge.node;

    const metafields: Record<string, string> = node.metafields?.edges
      ? node.metafields.edges.reduce((acc: any, curr: any) => {
          if (curr?.node?.key && curr?.node?.value) acc[curr.node.key] = curr.node.value;
          return acc;
        }, {})
      : {};

    const images = node.images?.edges?.map((iEdge: any) => ({
      url:     iEdge.node.url,
      altText: iEdge.node.altText || '',
    })) || [];

    const variants = node.variants?.edges?.map((vEdge: any) => ({
      id:                vEdge.node.id,
      title:             vEdge.node.title,
      price:             vEdge.node.price,
      compare_at_price:  vEdge.node.compareAtPrice,
      sku:               vEdge.node.sku,
      inventory:         vEdge.node.inventoryQuantity ?? 0,
      available:         vEdge.node.availableForSale ?? true,
    })) || [];

    return {
      id:              node.id,
      title:           node.title,
      handle:          node.handle,
      description:     stripHtml(node.descriptionHtml || ''),
      product_type:    node.productType || '',
      vendor:          node.vendor      || '',
      tags:            node.tags        || [],
      status:          node.status      || '',
      total_inventory: node.totalInventory ?? 0,
      images,
      variants,
      metafields,
    };
  }) || [];

  // ── Discounts (REST price_rules + codes) ──────────────────────────────────────
  const discounts = (rawData?.discounts || []).map((d: any) => ({
    id:                d.id,
    title:             d.title,
    value:             d.value,
    value_type:        d.value_type,
    target_type:       d.target_type,
    allocation_method: d.allocation_method,
    starts_at:         d.starts_at,
    ends_at:           d.ends_at,
    usage_limit:       d.usage_limit,
    codes:             d.codes || [],
  }));

  // ── Blog content (GraphQL) ────────────────────────────────────────────────────
  const blog_content: any[] = [];
  (rawData?.blogs?.edges || []).forEach((blogEdge: any) => {
    const blog = blogEdge.node;
    (blog.articles?.edges || []).forEach((artEdge: any) => {
      const article = artEdge.node;
      blog_content.push({
        id:           article.id,
        blog:         blog.title,
        title:        article.title,
        handle:       article.handle,
        author:       article.author?.name || '',
        tags:         article.tags  || [],
        published_at: article.publishedAt,
        body:         stripHtml(article.contentHtml || ''),
      });
    });
  });

  // ── Redirects (REST) ──────────────────────────────────────────────────────────
  const redirects = (rawData?.redirects || []).map((r: any) => ({
    path:   r.path,
    target: r.target,
  }));

  return { store_context, collections, catalog, discounts, blog_content, redirects };
}
