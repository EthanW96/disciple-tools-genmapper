<?php
if ( !defined( 'ABSPATH' ) ) {
    exit;
} // Exit if accessed directly.

/**
 * Metrics → (chart label) → Timelines, and an optional "Timeline" tile on group records.
 */
class DT_Genmapper_Timeline_Chart extends DT_Genmapper_Metrics_Chart_Base
{
    public $title = 'Timelines';
    public $slug = 'timeline'; // lowercase
    public $js_object_name = 'genTimeline';
    public $deep_link_hash = '#timeline';
    public $permissions = [ 'dt_all_access_contacts', 'view_project_metrics' ];

    const TILE_KEY = 'genmapper_timeline';

    public function __construct() {
        $this->title = __( 'Timelines', 'disciple-tools-genmapper' );
        parent::__construct();

        // Registered for everyone: the callback checks permissions (metrics, or viewing that one group)
        add_action( 'rest_api_init', [ $this, 'add_api_routes' ] );

        if ( 'metrics/genmapper/' . $this->slug === dt_get_url_path() && $this->has_permission() ) {
            add_action( 'wp_enqueue_scripts', [ $this, 'page_scripts' ], 99 );
        }
        if ( get_option( 'dt_genmapper_show_timeline_tile', false ) ) {
            add_filter( 'dt_details_additional_tiles', [ $this, 'add_tile' ], 30, 2 );
            add_action( 'dt_details_additional_section', [ $this, 'tile_content' ], 30, 3 );
            add_action( 'wp_enqueue_scripts', [ $this, 'tile_scripts' ], 99 );
        }
    }

    public function add_api_routes() {
        register_rest_route( $this->namespace, 'timeline', [
            [
                'methods' => WP_REST_Server::READABLE,
                'callback' => [ $this, 'timeline' ],
                'permission_callback' => [ $this, 'can_read_timeline' ],
                'args' => [
                    'group' => [
                        'type' => 'integer',
                        'minimum' => 0,
                        'default' => 0,
                        'sanitize_callback' => 'absint',
                    ],
                ],
            ],
        ] );
    }

    // The whole movement needs metrics access; one group only needs access to that group
    public function can_read_timeline( WP_REST_Request $request ) {
        if ( $this->has_permission() ) {
            return true;
        }
        $group_id = (int) $request->get_param( 'group' );
        return $group_id > 0 && DT_Posts::can_view( 'groups', $group_id ) === true;
    }

    public function timeline( WP_REST_Request $request ) {
        $queries = new DT_Genmapper_Timeline_Queries();
        return $queries->timeline( (int) $request->get_param( 'group' ) );
    }

    public function add_tile( $tiles, $post_type = '' ) {
        if ( $post_type === 'groups' ) {
            $tiles[ self::TILE_KEY ] = [ 'label' => __( 'Timeline', 'disciple-tools-genmapper' ) ];
        }
        return $tiles;
    }

    public function tile_content( $section, $post_type, $post_id = 0 ) {
        if ( $section === self::TILE_KEY && $post_type === 'groups' ) {
            ?>
            <div id="genmapper-timeline-tile" data-group-id="<?php echo esc_attr( (int) ( $post_id ? $post_id : get_the_ID() ) ) ?>"></div>
            <?php
        }
    }

    public function page_scripts() {
        $this->common_scripts();
        $this->enqueue( 'genmapper-timeline-swimlanes', 'timeline-swimlanes.js', [ 'genmapper-timeline-svg', 'genmapper-svg-text' ] );
        $this->enqueue( 'genmapper-timeline-time-to-ecclesia', 'timeline-time-to-ecclesia.js', [ 'genmapper-timeline-svg' ] );
        $this->enqueue( 'genmapper-timeline-stages', 'timeline-stages.js', [ 'genmapper-timeline-svg' ] );
        $charts_url = trailingslashit( dirname( plugin_dir_url( __FILE__ ) ) );
        $charts_path = trailingslashit( dirname( plugin_dir_path( __FILE__ ) ) );
        wp_enqueue_script( 'genmapper-print-frame', $charts_url . 'print-frame.js', [], filemtime( $charts_path . 'print-frame.js' ), true );
        wp_enqueue_style( 'genmapper-timeline-print', plugin_dir_url( __FILE__ ) . 'timeline-print.css', [], filemtime( plugin_dir_path( __FILE__ ) . 'timeline-print.css' ) );
        $this->enqueue( 'genmapper-timeline-print-layout', 'timeline-print-layout.js', [] );
        $this->enqueue( 'genmapper-timeline-print', 'timeline-print.js', [ 'genmapper-print-frame', 'genmapper-timeline-print-layout', 'genmapper-timeline-watch', 'genmapper-timeline-swimlanes', 'genmapper-timeline-time-to-ecclesia', 'genmapper-timeline-stages' ] );
        $this->enqueue( 'genmapper-timeline-page', 'timeline-page.js', [ 'genmapper-timeline-journey', 'genmapper-timeline-watch', 'genmapper-timeline-print', 'genmapper-timeline-swimlanes', 'genmapper-timeline-time-to-ecclesia', 'genmapper-timeline-stages' ] );
    }

    public function tile_scripts() {
        if ( !is_singular( 'groups' ) || !DT_Posts::can_view( 'groups', get_the_ID() ) ) {
            return;
        }
        $this->common_scripts();
        $this->enqueue( 'genmapper-timeline-tile', 'timeline-tile.js', [ 'genmapper-timeline-journey', 'genmapper-timeline-watch' ] );
    }

    private function common_scripts() {
        $charts_url = trailingslashit( dirname( plugin_dir_url( __FILE__ ) ) );
        $charts_path = trailingslashit( dirname( plugin_dir_path( __FILE__ ) ) );
        wp_enqueue_script( 'genmapper-svg-text', $charts_url . 'svg-text.js', [], filemtime( $charts_path . 'svg-text.js' ), true );
        wp_enqueue_style( 'genmapper-timeline', plugin_dir_url( __FILE__ ) . 'timeline.css', [], filemtime( plugin_dir_path( __FILE__ ) . 'timeline.css' ) );
        $this->enqueue( 'genmapper-timeline-data', 'timeline-data.js', [] );
        $this->enqueue( 'genmapper-timeline-svg', 'timeline-svg.js', [ 'genmapper-timeline-data' ] );
        $this->enqueue( 'genmapper-timeline-journey', 'timeline-journey.js', [ 'genmapper-timeline-svg' ] );
        $this->enqueue( 'genmapper-timeline-flags', 'timeline-flags.js', [ 'genmapper-timeline-data' ] );
        $this->enqueue( 'genmapper-timeline-watch', 'timeline-watch.js', [ 'genmapper-timeline-svg', 'genmapper-timeline-flags' ] );
        wp_localize_script( 'genmapper-timeline-data', $this->js_object_name, [
            'root' => esc_url_raw( rest_url() ),
            'nonce' => wp_create_nonce( 'wp_rest' ),
            'chart_label' => DT_Genmapper_Metrics::chart_label(),
            'groups_url' => esc_url_raw( site_url( '/groups/' ) ),
            'can_view_movement' => $this->has_permission(),
            'watch' => DT_Genmapper_Health_Watch::settings(),
            'strings' => array_merge( $this->strings(), self::watch_strings() ),
        ] );
    }

    private function enqueue( string $handle, string $file, array $deps ) {
        wp_enqueue_script( $handle, plugin_dir_url( __FILE__ ) . $file, $deps, filemtime( plugin_dir_path( __FILE__ ) . $file ), true );
    }

    /**
     * Health watch wording, shared with the egg chart's flag badges.
     *
     * @return array
     */
    public static function watch_strings(): array {
        $terms = DT_Genmapper_Metrics::dt_terms();
        $settings = DT_Genmapper_Health_Watch::settings();
        return [
            'health_watch' => __( 'Health watch', 'disciple-tools-genmapper' ),
            'watch_caption' => __( 'Groups that may need a check-in, most pressing first.', 'disciple-tools-genmapper' ),
            'watch_none' => __( 'Nothing flagged for this selection.', 'disciple-tools-genmapper' ),
            'watch_pace' => __( 'Behind the usual pace', 'disciple-tools-genmapper' ),
            'watch_quiet' => __( 'Gone quiet', 'disciple-tools-genmapper' ),
            'watch_health' => __( 'Health slipping', 'disciple-tools-genmapper' ),
            'watch_data' => __( 'Data to tidy', 'disciple-tools-genmapper' ),
            'all_groups' => __( 'All groups', 'disciple-tools-genmapper' ),
            'flagged_only' => __( 'Flagged only', 'disciple-tools-genmapper' ),
            'flags_title' => __( 'Worth checking', 'disciple-tools-genmapper' ),
            'what_to_check' => __( 'What to check', 'disciple-tools-genmapper' ),
            'since' => __( 'Since', 'disciple-tools-genmapper' ),
            /* translators: {count}: number of groups */
            'show_all' => __( 'Show all {count}', 'disciple-tools-genmapper' ),
            /* translators: {share}: a percentage */
            'pace_summary' => __( 'Usual pace ({share}% of groups):', 'disciple-tools-genmapper' ),
            /* translators: {milestone}: e.g. Coach; {months}: number of months */
            'pace_item' => __( '{milestone} by {months} months', 'disciple-tools-genmapper' ),
            /* translators: {milestone}: e.g. Coach; {months}: number of months */
            'pace_default' => __( '{milestone} by {months} months (guide: too few groups yet)', 'disciple-tools-genmapper' ),
            /* translators: {milestone}: e.g. Coach */
            'pace_uncommon' => __( '{milestone}: most groups never get there, so not flagged', 'disciple-tools-genmapper' ),
            'pace_coach' => __( 'Coach', 'disciple-tools-genmapper' ),
            'pace_group' => $terms['group'],
            'pace_baptism' => __( 'First baptism', 'disciple-tools-genmapper' ),
            'pace_ecclesia' => $terms['church'],
            'pace_multiplied' => __( 'First child group', 'disciple-tools-genmapper' ),
            'flag_milestone_coach' => __( 'No coach yet', 'disciple-tools-genmapper' ),
            /* translators: %s: the site's word for a pre-group */
            'flag_milestone_group' => sprintf( __( 'Still a %s', 'disciple-tools-genmapper' ), $terms['pre_group'] ),
            'flag_milestone_baptism' => __( 'No baptisms yet', 'disciple-tools-genmapper' ),
            /* translators: %s: the site's word for a church, e.g. Ecclesia */
            'flag_milestone_ecclesia' => sprintf( __( 'Not yet %s', 'disciple-tools-genmapper' ), $terms['church'] ),
            'flag_milestone_multiplied' => __( 'Not multiplied yet', 'disciple-tools-genmapper' ),
            /* translators: {age}: months since the group started, {share}: a percentage, {norm}: months */
            'flag_overdue_movement' => __( '{age} months in; {share}% of groups got there by {norm} months', 'disciple-tools-genmapper' ),
            /* translators: {age}: months since the group started, {norm}: months */
            'flag_overdue_default' => __( '{age} months in; the usual guide is {norm} months (too few groups yet to measure your own pace)', 'disciple-tools-genmapper' ),
            /* translators: {months}: number of months */
            'flag_quiet' => __( 'No updates or comments for {months} months', 'disciple-tools-genmapper' ),
            /* translators: {practice}: a Church Health practice */
            'flag_practice_removed' => __( 'Practice no longer marked: {practice}', 'disciple-tools-genmapper' ),
            /* translators: %s: the site's word for a church; {practices}: list of Church Health practices */
            'flag_missing_practices' => sprintf( __( '%s without: {practices}', 'disciple-tools-genmapper' ), $terms['church'] ),
            /* translators: {from} and {to}: member counts */
            'flag_members_dropped' => __( 'Members down from {from} to {to}', 'disciple-tools-genmapper' ),
            'flag_no_members' => __( 'Member Count is 0', 'disciple-tools-genmapper' ),
            'flag_no_start_date' => __( 'No Start Date', 'disciple-tools-genmapper' ),
            'flag_no_church_start_date' => __( 'No Church Start Date (using when the change was recorded)', 'disciple-tools-genmapper' ),
            'flag_dates_out_of_order' => __( 'Dates out of order', 'disciple-tools-genmapper' ),
            'coaching_load' => __( 'Coaching load', 'disciple-tools-genmapper' ),
            /* translators: %1$d: number of groups */
            'coaching_load_caption' => sprintf( __( 'Coaches with more than %1$d active groups, and coaching groups with more than %1$d active groups per member.', 'disciple-tools-genmapper' ), $settings['maxGroupsPerCoach'] ),
            'coaching_load_none' => __( 'No one is over the limit.', 'disciple-tools-genmapper' ),
            'coach' => __( 'Coach', 'disciple-tools-genmapper' ),
            'coaching_group' => __( 'Coaching group', 'disciple-tools-genmapper' ),
            'active_groups' => __( 'Active groups', 'disciple-tools-genmapper' ),
            'members' => __( 'Members', 'disciple-tools-genmapper' ),
            'groups_per_member' => __( 'Groups per member', 'disciple-tools-genmapper' ),
        ];
    }

    private function strings(): array {
        $terms = DT_Genmapper_Metrics::dt_terms();
        return [
            'timelines' => $this->title,
            'pre_group' => $terms['pre_group'],
            'group' => $terms['group'],
            'ecclesia' => $terms['church'],
            'loading' => __( 'Loading…', 'disciple-tools-genmapper' ),
            'load_failed' => __( 'The timelines could not be loaded. Please try again.', 'disciple-tools-genmapper' ),
            'tree' => __( 'Tree', 'disciple-tools-genmapper' ),
            'all_trees' => __( 'All trees', 'disciple-tools-genmapper' ),
            'period' => __( 'Period', 'disciple-tools-genmapper' ),
            'all_time' => __( 'All time', 'disciple-tools-genmapper' ),
            'last_3_years' => __( 'Last 3 years', 'disciple-tools-genmapper' ),
            'last_year' => __( 'Last 12 months', 'disciple-tools-genmapper' ),
            'include_inactive' => __( 'Include groups that ended', 'disciple-tools-genmapper' ),
            'journey' => __( 'Journey', 'disciple-tools-genmapper' ),
            'journey_hint' => __( 'Click a group in the swimlanes below to see its journey here.', 'disciple-tools-genmapper' ),
            'swimlanes' => __( 'Swimlanes', 'disciple-tools-genmapper' ),
            'swimlanes_caption' => __( 'One row per group, parents before their child groups. Hover for details; click a row for its journey.', 'disciple-tools-genmapper' ),
            'swimlanes_label' => __( 'Swimlane chart of groups with their stages and events over time', 'disciple-tools-genmapper' ),
            /* translators: %s: the site's word for a church, e.g. Ecclesia */
            'time_to_ecclesia' => sprintf( __( 'Time from start to %s', 'disciple-tools-genmapper' ), $terms['church'] ),
            /* translators: %s: the site's word for a church, e.g. Ecclesia */
            'time_to_ecclesia_caption' => sprintf( __( 'Share of groups that have reached %s, by months since they started. Groups that have not reached it yet still count until today (ticks).', 'disciple-tools-genmapper' ), $terms['church'] ),
            /* translators: %s: the site's word for a church, e.g. Ecclesia */
            'time_to_ecclesia_label' => sprintf( __( 'Step curve of the share of groups that have reached %s, by months since start', 'disciple-tools-genmapper' ), $terms['church'] ),
            'stages_over_time' => __( 'Groups by stage over time', 'disciple-tools-genmapper' ),
            'stages_over_time_caption' => __( 'How many groups were in each stage, month by month.', 'disciple-tools-genmapper' ),
            'stages_over_time_label' => __( 'Stacked area chart of groups in each stage per month', 'disciple-tools-genmapper' ),
            'baptisms' => __( 'Baptisms', 'disciple-tools-genmapper' ),
            'coach_assigned' => __( 'Coach assigned', 'disciple-tools-genmapper' ),
            'multiplied' => __( 'Multiplied (child group)', 'disciple-tools-genmapper' ),
            'health_added' => __( 'Health practice marked', 'disciple-tools-genmapper' ),
            'recorded_on' => __( 'recorded in D.T. on', 'disciple-tools-genmapper' ),
            'recorded' => __( 'recorded in D.T.', 'disciple-tools-genmapper' ),
            'entered_in_dt' => __( 'Entered in D.T.', 'disciple-tools-genmapper' ),
            'started' => __( 'Started', 'disciple-tools-genmapper' ),
            'became' => __( 'Became', 'disciple-tools-genmapper' ),
            'became_ecclesia' => sprintf( /* translators: %s: the site's word for a church, e.g. Ecclesia */ __( 'Became %s', 'disciple-tools-genmapper' ), $terms['church'] ),
            'ended' => __( 'Ended', 'disciple-tools-genmapper' ),
            'today' => __( 'today', 'disciple-tools-genmapper' ),
            'months' => __( 'months', 'disciple-tools-genmapper' ),
            'months_short' => __( 'mo', 'disciple-tools-genmapper' ),
            'months_after_start' => __( 'months after start', 'disciple-tools-genmapper' ),
            'months_to_ecclesia' => __( 'Months to get there', 'disciple-tools-genmapper' ),
            'had_become_ecclesia' => sprintf( /* translators: %s: the site's word for a church, e.g. Ecclesia */ __( 'had reached %s', 'disciple-tools-genmapper' ), $terms['church'] ),
            'median' => __( 'Median', 'disciple-tools-genmapper' ),
            'median_time' => __( 'Median time to get there', 'disciple-tools-genmapper' ),
            'within_12_months' => __( 'Within 12 months', 'disciple-tools-genmapper' ),
            'groups_counted' => __( 'Groups counted', 'disciple-tools-genmapper' ),
            'still_on_their_way' => __( 'still on their way', 'disciple-tools-genmapper' ),
            'not_reached_yet' => __( 'Not reached yet', 'disciple-tools-genmapper' ),
            'small_sample' => __( 'Fewer than 10 groups: treat these figures as a rough guide.', 'disciple-tools-genmapper' ),
            'no_groups' => __( 'No groups to show for this selection.', 'disciple-tools-genmapper' ),
            'no_start_date' => __( 'This group has no start date yet, so there is no timeline to show.', 'disciple-tools-genmapper' ),
            'timeline_of' => __( 'Timeline of', 'disciple-tools-genmapper' ),
            'show_journey' => __( 'Show journey', 'disciple-tools-genmapper' ),
            'show_table' => __( 'Show as a table', 'disciple-tools-genmapper' ),
            'name' => __( 'Name', 'disciple-tools-genmapper' ),
            'generation' => __( 'Generation', 'disciple-tools-genmapper' ),
            'data_note' => __( 'About the data', 'disciple-tools-genmapper' ),
            'quality_no_start' => __( 'groups have no Start Date (using when they were entered in D.T.)', 'disciple-tools-genmapper' ),
            'quality_logged_ecclesia' => __( 'ecclesia dates come from when the change was recorded in D.T.', 'disciple-tools-genmapper' ),
            'print' => __( 'Print', 'disciple-tools-genmapper' ),
            'print_title' => __( 'Print on A4 (landscape)', 'disciple-tools-genmapper' ),
            'print_intro' => __( 'Prints what the filters show now. Long swimlanes continue over several sheets that tape together top to bottom.', 'disciple-tools-genmapper' ),
            'print_actual_size' => __( 'Print at 100% ("Actual size", not "Fit to page") so the sheets line up.', 'disciple-tools-genmapper' ),
            /* translators: {next}: sheet number */
            'print_join_note' => __( 'To join: trim sheet {next} on its dashed line, lay it over the last row of this sheet and line up the ticks and crosses.', 'disciple-tools-genmapper' ),
            /* translators: {previous}: sheet number */
            'print_trim_note' => __( 'Trim on the dashed line; the grey row repeats the last row of sheet {previous}.', 'disciple-tools-genmapper' ),
            /* translators: {previous}: sheet number */
            'print_continued' => __( 'continued from sheet {previous}', 'disciple-tools-genmapper' ),
            /* translators: {number} and {total}: sheet numbers */
            'print_sheet_of' => __( 'Sheet {number} of {total}', 'disciple-tools-genmapper' ),
            'printed' => __( 'Printed', 'disciple-tools-genmapper' ),
            'print_nothing' => __( 'Nothing selected to print.', 'disciple-tools-genmapper' ),
            'print_failed' => __( 'The print-out could not be opened. Please try again.', 'disciple-tools-genmapper' ),
            'cancel' => __( 'Cancel', 'disciple-tools-genmapper' ),
            'active_only' => __( 'Active groups only', 'disciple-tools-genmapper' ),
            'quality_issues' => __( 'groups have dates out of order (e.g. ecclesia before start)', 'disciple-tools-genmapper' ),
        ];
    }
}
