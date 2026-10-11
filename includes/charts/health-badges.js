// Egg chart: an amber "!" badge on the circle of each group the health watch flags,
// with the reasons on hover. Only loaded when "Show health flags on the group chart?" is on.
(function () {
  'use strict'

  const config = window.genHealthFlags
  const BADGE = { x: 30, y: 2, radius: 8 } // the circle's top-right corner, clear of the hover buttons

  let flagsById = null
  let settings = null

  const tooltipText = (flags) => [config.strings.flags_title]
    .concat(flags.map((flag) => `! ${window.GenMapperTimelineWatch.reason(flag, config.strings, settings)}`))
    .join('\n')

  // Draws badges on the nodes currently in the chart (call after every redraw); chart is an element or selector
  const draw = (chartElement) => {
    if (!flagsById) {
      return
    }
    d3.select(chartElement).selectAll('g.node').each(function (d) {
      const node = d3.select(this)
      node.select('.node-flag').remove()
      // Chart ids may be numbers or strings
      const flags = d && d.data ? flagsById.get(String(d.data.id)) || [] : []
      if (!flags.length) {
        return
      }
      const badge = node.append('g').attr('class', 'node-flag')
      badge.append('title').text(tooltipText(flags))
      badge.append('circle').attr('cx', BADGE.x).attr('cy', BADGE.y).attr('r', BADGE.radius)
      badge.append('text').attr('x', BADGE.x).attr('y', BADGE.y + 4).attr('text-anchor', 'middle').text('!')
    })
  }

  /**
   * Loads the movement's timelines and works out the flags.
   * @returns {Promise<void>} resolves once badges can be drawn
   */
  const load = () => fetch(`${config.root}dt/v1/genmapper/timeline`, { headers: { 'X-WP-Nonce': config.nonce } })
    .then((response) => response.json().then((body) => ({ ok: response.ok, body })))
    .then(({ ok, body }) => {
      if (!ok || !body || !Array.isArray(body.groups)) {
        throw new Error((body && body.message) || 'Health flags could not be loaded')
      }
      const now = Math.floor(Date.now() / 1000)
      const stageById = new Map(body.groups.map((group) => [group.id, window.GenMapperTimelineData.stages(group, now)]))
      const analysis = window.GenMapperTimelineWatch.analyse(body.groups, stageById, body.coaching_groups || [], config.watch, now)
      flagsById = new Map(Array.from(analysis.flagsById.entries()).map(([id, flags]) => [String(id), flags]))
      settings = analysis.settings
    })

  window.GenMapperHealthBadges = { load, draw }
})()
