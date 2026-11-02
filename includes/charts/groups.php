<?php
if ( !defined( 'ABSPATH' )) {
    exit;
} // Exit if accessed directly.

class DT_Genmapper_Groups_Chart extends DT_Genmapper_Metrics_Chart_Base
{

    public $title = 'Groups';
    public $slug = 'groups'; // lowercase
    public $js_object_name = 'wpApiGenmapper'; // This object will be loaded into the metrics.js file by the wp_localize_script.
    public $js_file_name = 'groups.js'; // should be full file name plus extension
    public $deep_link_hash = '#groups'; // should be the full hash name. #genmapper_of_hash
    public $permissions = [ 'dt_all_access_contacts', 'view_project_metrics' ];

    public function __construct() {
        parent::__construct();
        if ( !$this->has_permission()) {
            return;
        }
        $url_path = dt_get_url_path();

        // only load scripts if exact url
        if ('metrics/genmapper/' . $this->slug === $url_path) {
            add_action( 'wp_enqueue_scripts', [ $this, 'scripts' ], 99 );
        }
        add_action( 'rest_api_init', [ $this, 'add_api_routes' ] );
    }

    /**
     * Load scripts for the plugin
     */
    public function scripts() {
        wp_enqueue_style( "hint", "https://cdnjs.cloudflare.com/ajax/libs/hint.css/2.5.1/hint.min.css", [], "2.5.1" );
        wp_enqueue_style( "group-styles", trailingslashit( plugin_dir_url( __FILE__ ) ) . "church-circles/style.css", [], filemtime( plugin_dir_path( __FILE__ ) . "church-circles/style.css" ) );
        wp_enqueue_style( "styles", trailingslashit( plugin_dir_url( __FILE__ ) ) . "style.css", [], filemtime( plugin_dir_path( __FILE__ ) . "style.css" ) );
        wp_register_script( 'd3', 'https://d3js.org/d3.v5.min.js', false, '5' );

        $group_fields = DT_Posts::get_post_field_settings( "groups" );
        wp_enqueue_script('gen-template', trailingslashit( plugin_dir_url( __FILE__ ) ) . "church-circles/template.js", [
            'jquery',
            'jquery-ui-core',
            'wp-i18n'
        ], filemtime( plugin_dir_path( __FILE__ ) . "church-circles/template.js" ), true);
        wp_localize_script(
            'gen-template', 'genApiTemplate', [
                'plugin_uri' => plugin_dir_url( __DIR__ ),
                'group_fields' => $group_fields,
                'show_metrics' => get_option( "dt_genmapper_show_health_metrics", false ),
                'show_icons' => get_option( "dt_genmapper_show_health_icons", true ),
            ]
        );

        // Fill-in "update map" print: eggs with spaces to write updated values
        wp_enqueue_script('genmapper-update-map', trailingslashit( plugin_dir_url( __FILE__ ) ) . "genmapper-update-map.js", [
            'd3',
        ], filemtime( plugin_dir_path( __FILE__ ) . "genmapper-update-map.js" ), true);
        $languages = [];
        foreach ( dt_get_available_languages() as $language ) {
            $languages[] = [
                'code' => $language['language'],
                'name' => $language['native_name'] ?? $language['language'],
            ];
        }
        wp_localize_script(
            'genmapper-update-map', 'genmapperUpdateMapSettings', [
                'root' => esc_url_raw( rest_url( $this->namespace . '/print-labels' ) ),
                'nonce' => wp_create_nonce( 'wp_rest' ),
                'languages' => $languages,
                'locale' => get_user_locale(),
                'translations' => [
                    'button' => __( 'Print update map', 'disciple-tools-genmapper' ),
                    'dialog_title' => __( 'Print update map', 'disciple-tools-genmapper' ),
                    'dialog_help' => __( 'Prints the groups shown in the tree with space around each one to write updated values.', 'disciple-tools-genmapper' ),
                    'language' => __( 'Language', 'disciple-tools-genmapper' ),
                    'paper' => __( 'Paper', 'disciple-tools-genmapper' ),
                    'letter' => __( 'Letter', 'disciple-tools-genmapper' ),
                    'landscape' => __( 'Landscape', 'disciple-tools-genmapper' ),
                    'portrait' => __( 'Portrait', 'disciple-tools-genmapper' ),
                    'print' => __( 'Print', 'disciple-tools-genmapper' ),
                    'cancel' => __( 'Cancel', 'disciple-tools-genmapper' ),
                    'error' => __( 'Could not prepare the update map. Please try again.', 'disciple-tools-genmapper' ),
                ],
            ]
        );

        // Enqueue GenMapperPoster before genmapper
        wp_enqueue_script('genmapper-poster', trailingslashit( plugin_dir_url( __FILE__ ) ) . "genmapper-poster.js", [
            'jquery',
            'd3'
        ], filemtime( plugin_dir_path( __FILE__ ) . "genmapper-poster.js" ), true);


        wp_enqueue_script('genmapper', trailingslashit( plugin_dir_url( __FILE__ ) ) . "genmapper.js", [
            'jquery',
            'jquery-ui-core',
            'd3',
            'gen-template',
            'genmapper-poster',
            'wp-i18n'
        ], filemtime( plugin_dir_path( __FILE__ ) . "genmapper.js" ), true);
        wp_localize_script(
            'genmapper', 'genApiTemplate', [
                'show_metrics' => get_option( "dt_genmapper_show_health_metrics", false ),
                'show_icons' => get_option( "dt_genmapper_show_health_icons", true ),
            ]
        );
        wp_enqueue_script('dt_' . $this->slug . '_script', trailingslashit( plugin_dir_url( __FILE__ ) ) . $this->js_file_name, [
            'jquery',
            'jquery-ui-core',
            'genmapper',
            'wp-i18n'
        ], filemtime( plugin_dir_path( __FILE__ ) . $this->js_file_name ), true);

        // Localize script with array data
        wp_localize_script(
            'dt_' . $this->slug . '_script', $this->js_object_name, [
                'name_key' => $this->slug,
                'root' => esc_url_raw( rest_url() ),
                'plugin_uri' => plugin_dir_url( __DIR__ ),
                'nonce' => wp_create_nonce( 'wp_rest' ),
                'current_user_login' => wp_get_current_user()->user_login,
                'current_user_id' => get_current_user_id(),
                'spinner' => '<img src="' . trailingslashit( plugin_dir_url( __DIR__ ) ) . 'ajax-loader.gif" style="height:1em;" />',
                'translation' => [
                    'string1' => __( 'Group Generation Tree', 'disciple-tools-genmapper' ),
                    'string2' => __( 'This tree only shows First Generation groups that have multiplied.', 'disciple-tools-genmapper' ),
                    'string3' => __( 'See descendants of a specific group', 'disciple-tools-genmapper' ),
                    'string4' => __( 'Reset', 'disciple-tools-genmapper' ),
                ]
            ]
        );
    }

    //${localizedObject.translation.string /**/}

    public function add_api_routes() {
        register_rest_route(
            $this->namespace, 'groups', [
                [
                    'methods'  => WP_REST_Server::READABLE,
                    'callback' => [ $this, 'groups' ],
                    'permission_callback' => '__return_true',
                ],
            ]
        );
        register_rest_route(
            $this->namespace, 'print-labels', [
                [
                    'methods'  => WP_REST_Server::READABLE,
                    'callback' => [ $this, 'print_labels' ],
                    'permission_callback' => function () {
                        return is_user_logged_in() && DT_Posts::can_access( 'groups' );
                    },
                ],
            ]
        );
    }

    /**
     * Labels for the update map print, in the requested language: D.T field names and
     * option labels (including custom translations) plus this plugin's own strings.
     *
     * @param WP_REST_Request $request
     * @return array
     */
    public function print_labels( WP_REST_Request $request ) {
        $requested = sanitize_text_field( (string) $request->get_param( 'lang' ) );
        $available = wp_list_pluck( dt_get_available_languages(), 'language' );
        $locale = in_array( $requested, $available, true ) ? $requested : get_user_locale();

        switch_to_locale( $locale );
        // D.T reads the user's locale for custom field and option label translations.
        wp_get_current_user()->locale = $locale;
        add_filter( 'pre_determine_locale', function () use ( $locale ) {
            return $locale;
        } );
        unload_textdomain( 'disciple_tools' );
        load_theme_textdomain( 'disciple_tools', get_template_directory() . '/dt-assets/translation' );
        unload_textdomain( 'disciple-tools-genmapper' );
        load_textdomain( 'disciple-tools-genmapper', DT_Genmapper_Metrics::dir() . 'languages/disciple-tools-genmapper-' . $locale . '.mo' );

        $fields = DT_Posts::get_post_field_settings( 'groups', false );

        // Same keys the tree data uses for its counts (see groups()).
        $counts = [];
        foreach ( [ 'member_count' => 'attenders', 'believer_count' => 'believers', 'baptized_count' => 'baptized', 'baptized_in_group_count' => 'newlyBaptized' ] as $field_key => $data_key ) {
            if ( empty( $fields[ $field_key ] ) || ! empty( $fields[ $field_key ]['hidden'] ) ) {
                continue;
            }
            $counts[] = [
                'key' => $data_key,
                'label' => $fields[ $field_key ]['name'] ?? $field_key,
                'icon' => $fields[ $field_key ]['icon'] ?? '',
            ];
        }

        $health = [];
        foreach ( $fields['health_metrics']['default'] ?? [] as $option_key => $option ) {
            if ( ! empty( $option['deleted'] ) ) {
                continue;
            }
            $health[] = [
                'key' => 'health_metrics_' . str_replace( 'church_', '', $option_key ),
                'option' => $option_key,
                'label' => $option['label'] ?? $option_key,
                'icon' => $option['icon'] ?? '',
            ];
        }

        $connection_field = get_option( 'dt_genmapper_connection_display', 'coach' ) === 'leaders' ? 'leaders' : 'coaches';

        $result = [
            'locale' => $locale,
            'rtl' => is_rtl(),
            'counts' => $counts,
            'health' => $health,
            'labels' => [
                'coach' => $fields[ $connection_field ]['name'] ?? $connection_field,
                'location' => $fields['location_grid']['name'] ?? __( 'Location', 'disciple-tools-genmapper' ),
                'start_date' => $fields['start_date']['name'] ?? __( 'Start Date', 'disciple-tools-genmapper' ),
                'group_type' => $fields['group_type']['name'] ?? 'group_type',
                'group' => $fields['group_type']['default']['group']['label'] ?? 'Group',
                'church' => $fields['group_type']['default']['church']['label'] ?? 'Church',
                'inactive' => $fields['group_status']['default']['inactive']['label'] ?? 'Inactive',
            ],
            'strings' => [
                'title' => __( 'Update map', 'disciple-tools-genmapper' ),
                /* translators: 1: page number, 2: total pages */
                'page' => __( 'Page %1$s of %2$s', 'disciple-tools-genmapper' ),
                /* translators: %s: date */
                'printed' => __( 'Printed %s', 'disciple-tools-genmapper' ),
                'updated_by' => __( 'Updated by', 'disciple-tools-genmapper' ),
                'date' => __( 'Date', 'disciple-tools-genmapper' ),
                'notes' => __( 'Notes', 'disciple-tools-genmapper' ),
                'legend_counts' => __( 'Write new numbers in the boxes.', 'disciple-tools-genmapper' ),
                'legend_health' => __( 'Circle practices the group has started; cross out ones it has stopped.', 'disciple-tools-genmapper' ),
                'legend_lines' => __( 'Write changes on the lines.', 'disciple-tools-genmapper' ),
                /* translators: %s: parent group record number */
                'from_parent_here' => __( 'from #%s', 'disciple-tools-genmapper' ),
                /* translators: 1: parent group record number, 2: page number */
                'from_parent' => __( 'from #%1$s (p. %2$s)', 'disciple-tools-genmapper' ),
                /* translators: %s: list of page numbers */
                'continues' => __( 'more child groups: p. %s', 'disciple-tools-genmapper' ),
                'all_groups' => __( 'All groups', 'disciple-tools-genmapper' ),
            ],
        ];

        restore_previous_locale();
        return $result;
    }

    /**
     * Respond to transfer request of files
     *
     * @param WP_REST_Request $request
     * @return array|WP_Error
     */
    public function groups( WP_REST_Request $request ) {

        $params = $request->get_params();

        global $wpdb;
        $prepared_array = [
            [
                "id" => 0,
                "parentId" => "",
                "name" => "source"
            ]
        ];
        $groups = dt_genmapper_plugin_queries()->tree( 'multiplying_groups_only' );
        if (is_wp_error( $groups )) {
            return $groups;
        }

        if ( !empty( $params["node"] && $params["node"] != "null" )) {
            $node = [];
            foreach ($groups as $group) {
                if ($group["id"] === $params["node"]) {
                    $prepared_array = [];
                    $node = $group;
                    $node["parent_id"] = "";
                }
            }

            $groups = array_merge( [ $node ], $this->get_node_descendants( $groups, [ $params["node"] ] ) );
        }

        foreach ($groups as $group) {
            $lines = [];
            $lines[] = $group['name'];
            if ($group["coach"]) {
                $lines[] = $group['coach'];
            }
            $location_display = !empty( $group['location_meta_label'] )
                ? $group['location_meta_label']
                : $group['location_name'];
            if ( $location_display ) {
                $lines[] = $location_display;
            }
            if ($group['start_date']) {
                $lines[] = gmdate( get_option( 'date_format' ), intval( $group['start_date'] ) );
            }

            $values = [
                "object_type" => 'group',
                "id" => $group["id"],
                "parentId" => $group["parent_id"] ?? 0,
                "name" => $group["name"],
                "line_1" => array_shift( $lines ),
                "line_2" => array_shift( $lines ),
                "line_3" => array_shift( $lines ),
                "line_4" => array_shift( $lines ),
                "church" => $group["group_type"] === "church",
                "active" => $group["group_status"] === "active",
                "group_type" => $group["group_type"],
                "post_type" => "groups",
                "coach" => $group["coach"],
                "location" => $location_display,
                "start_date" => $group['start_date'] ? gmdate( get_option( 'date_format' ), strtotime( $group['start_date'] ) ) : null,
                "start_date_timestamp" => $group['start_date'] ? ( is_numeric( $group['start_date'] ) ? (int) $group['start_date'] : (int) strtotime( $group['start_date'] ) ) : null,
                "attenders" => (int) $group['total_members'],
                "believers" => (int) $group['total_believers'],
                "baptized" => (int) $group['total_baptized'],
                "newlyBaptized" => (int) $group['total_baptized_by_group'],
                "health_metrics_baptism" => (bool) $group['health_metrics_baptism'],
                "health_metrics_bible" => (bool) $group['health_metrics_bible'],
                "health_metrics_commitment" => (bool) $group['health_metrics_commitment'],
                "health_metrics_communion" => (bool) $group['health_metrics_communion'],
                "health_metrics_giving" => (bool) $group['health_metrics_giving'],
                "health_metrics_leaders" => (bool) $group['health_metrics_leaders'],
                "health_metrics_fellowship" => (bool) $group['health_metrics_fellowship'],
                "health_metrics_praise" => (bool) $group['health_metrics_praise'],
                "health_metrics_prayer" => (bool) $group['health_metrics_prayer'],
                "health_metrics_sharing" => (bool) $group['health_metrics_sharing'],
            ];
            $prepared_array[] = $values;
        }

        if (empty( $prepared_array )) {
            return new WP_Error( 'failed_to_build_data', 'Failed to build data', [ 'status' => 400 ] );
        } else {
            return $prepared_array;
        }
    }
}
