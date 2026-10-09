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
                'show_coaching' => get_option( "dt_genmapper_show_coaching", false ),
                'show_generation' => get_option( "dt_genmapper_show_generation", false ),
                'show_people_count' => get_option( "dt_genmapper_show_people_count", false ),
                'coaching_enabled' => DT_Genmapper_Metrics::coaching_group_type() !== '',
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
                'show_coaching' => get_option( "dt_genmapper_show_coaching", false ),
                'show_generation' => get_option( "dt_genmapper_show_generation", false ),
                'show_people_count' => get_option( "dt_genmapper_show_people_count", false ),
                'coaching_enabled' => DT_Genmapper_Metrics::coaching_group_type() !== '',
            ]
        );
        wp_enqueue_script('dt_' . $this->slug . '_script', trailingslashit( plugin_dir_url( __FILE__ ) ) . $this->js_file_name, [
            'jquery',
            'jquery-ui-core',
            'genmapper',
            'wp-i18n'
        ], filemtime( plugin_dir_path( __FILE__ ) . $this->js_file_name ), true);

        $this->print_pack_scripts( $group_fields );

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
                    'string2' => get_option( 'dt_genmapper_show_unmultiplied', false )
                        ? __( 'This tree shows all groups. Groups without a parent group start a new tree.', 'disciple-tools-genmapper' )
                        : __( 'This tree only shows First Generation groups that have multiplied.', 'disciple-tools-genmapper' ),
                    'string3' => __( 'See descendants of a specific group', 'disciple-tools-genmapper' ),
                    'string4' => __( 'Reset', 'disciple-tools-genmapper' ),
                    'coached' => __( 'Receiving coaching', 'disciple-tools-genmapper' ),
                    'not_coached' => __( 'No coach', 'disciple-tools-genmapper' ),
                    /* translators: %s: the site's label for the coaching group type, e.g. Team */
                    'coaching_legend' => sprintf( __( '%s: encloses the groups it coaches', 'disciple-tools-genmapper' ), $this->coaching_type_label() ),
                ]
            ]
        );
    }

    /**
     * Terms as named in this site's D.T settings (e.g. "Church" may be renamed "Ecclesia"),
     * so printed pages use the site's own words.
     *
     * @param array $group_fields field settings for the groups post type
     * @return array
     */
    private function dt_terms( array $group_fields ): array {
        $types = $group_fields['group_type']['default'] ?? [];
        $statuses = $group_fields['group_status']['default'] ?? [];
        $other_types = array_map(
            function ( $type ) {
                return $type['label'] ?? '';
            },
            array_diff_key( $types, [ 'church' => true ] )
        );
        return [
            'groups' => DT_Posts::get_label_for_post_type( 'groups' ),
            'church' => $types['church']['label'] ?? __( 'Church', 'disciple-tools-genmapper' ),
            'other_types' => implode( ' / ', array_filter( $other_types ) ),
            'active' => $statuses['active']['label'] ?? __( 'Active', 'disciple-tools-genmapper' ),
            'inactive' => $statuses['inactive']['label'] ?? __( 'Inactive', 'disciple-tools-genmapper' ),
        ];
    }

    /**
     * Print pack (one-page overview + a page per first-generation tree) for the Groups chart
     *
     * @param array $group_fields field settings for the groups post type
     */
    private function print_pack_scripts( array $group_fields ) {
        $terms = $this->dt_terms( $group_fields );
        $dir = trailingslashit( plugin_dir_url( __FILE__ ) ) . 'print-pack/';
        $path = plugin_dir_path( __FILE__ ) . 'print-pack/';

        wp_enqueue_style( 'genmapper-print-pack', $dir . 'print-pack.css', [], filemtime( $path . 'print-pack.css' ) );
        wp_enqueue_script( 'genmapper-print-pack-common', $dir . 'print-pack-common.js', [ 'genmapper' ], filemtime( $path . 'print-pack-common.js' ), true );
        wp_enqueue_script( 'genmapper-print-pack-overview', $dir . 'print-pack-overview.js', [ 'genmapper-print-pack-common' ], filemtime( $path . 'print-pack-overview.js' ), true );
        wp_enqueue_script( 'genmapper-print-pack-tree-pages', $dir . 'print-pack-tree-pages.js', [ 'genmapper-print-pack-common', 'd3' ], filemtime( $path . 'print-pack-tree-pages.js' ), true );
        wp_enqueue_script( 'genmapper-print-pack', $dir . 'print-pack.js', [ 'genmapper-print-pack-overview', 'genmapper-print-pack-tree-pages', 'genmapper-poster' ], filemtime( $path . 'print-pack.js' ), true );

        wp_localize_script( 'genmapper-print-pack-common', 'genPrintPack', [
            'translations' => [
                'chart_label' => DT_Genmapper_Metrics::chart_label(),
                'print_title' => __( 'Print', 'disciple-tools-genmapper' ),
                'overview_title' => __( 'Overview', 'disciple-tools-genmapper' ),
                /* translators: %s: the site's name for groups (plural), e.g. Groups */
                'overview_subtitle' => sprintf( __( '%s by generation. Each row shows the name and the leader.', 'disciple-tools-genmapper' ), $terms['groups'] ),
                'printed' => __( 'Printed', 'disciple-tools-genmapper' ),
                'printed_date' => date_i18n( get_option( 'date_format' ) ),
                'gen_prefix' => __( 'Gen', 'disciple-tools-genmapper' ),
                'legend_church' => $terms['church'],
                'legend_group' => $terms['other_types'],
                'legend_inactive' => $terms['inactive'],
                'legend_coached' => __( 'Receiving coaching', 'disciple-tools-genmapper' ),
                'legend_people' => $group_fields['member_count']['name'] ?? __( 'Member Count', 'disciple-tools-genmapper' ),
                'stat_groups' => $terms['groups'],
                'stat_active' => $terms['active'],
                'paper' => __( 'Paper', 'disciple-tools-genmapper' ),
                'orientation' => __( 'Orientation', 'disciple-tools-genmapper' ),
                'landscape' => __( 'Landscape', 'disciple-tools-genmapper' ),
                'portrait' => __( 'Portrait', 'disciple-tools-genmapper' ),
                /* translators: %s: the site's name for groups (plural), e.g. Groups */
                'include_overview' => sprintf( __( 'One-page overview of all %s', 'disciple-tools-genmapper' ), $terms['groups'] ),
                'include_trees' => __( 'A detailed page for each first-generation tree', 'disciple-tools-genmapper' ),
                'names_about' => __( 'Names print at about', 'disciple-tools-genmapper' ),
                'small_text_trees' => __( 'Small text on:', 'disciple-tools-genmapper' ),
                'small_text_hint' => __( 'try A3 or larger paper', 'disciple-tools-genmapper' ),
                'print' => __( 'Print', 'disciple-tools-genmapper' ),
                'cancel' => __( 'Cancel', 'disciple-tools-genmapper' ),
                'classic_poster' => __( 'Classic large poster', 'disciple-tools-genmapper' ),
                /* translators: %s: the site's name for groups (plural), e.g. Groups */
                'nothing_to_print' => sprintf( __( 'There is nothing on the chart to print (%s).', 'disciple-tools-genmapper' ), $terms['groups'] ),
                'print_failed' => __( 'The print window could not be opened. Please try again.', 'disciple-tools-genmapper' ),
            ],
        ] );
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
        $coaching_type = DT_Genmapper_Metrics::coaching_group_type();
        $groups = dt_genmapper_plugin_queries()->tree( 'multiplying_groups_only', [
            'include_unmultiplied' => (bool) get_option( 'dt_genmapper_show_unmultiplied', false ),
            'exclude_group_type' => $coaching_type,
        ] );
        if (is_wp_error( $groups )) {
            return $groups;
        }
        $coaching = $this->coaching_by_group( $coaching_type );
        if ( is_wp_error( $coaching ) ) {
            return $coaching;
        }

        // Generations come from the full tree so a rebased view keeps real numbers.
        $generations = $this->get_generations( $groups );

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
                "coached" => !empty( $group['has_coach'] ),
                "coaching" => $coaching[ (int) ( $group['id'] ?? 0 ) ] ?? [],
                /* translators: %d: generation number of the group, 1 = first generation */
                "generation_label" => sprintf( __( 'Gen %d', 'disciple-tools-genmapper' ), $generations[ $group['id'] ] ?? 1 ),
                "generation" => $generations[ $group['id'] ] ?? 1,
                "location" => $location_display,
                "start_date" => $group['start_date'] ? gmdate( get_option( 'date_format' ), strtotime( $group['start_date'] ) ) : null,
                "attenders" => (int) $group['total_members'],
                "people_count" => (int) $group['total_members'],
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

    private function coaching_type_label(): string {
        $type = DT_Genmapper_Metrics::coaching_group_type();
        return $type === '' ? '' : ( DT_Genmapper_Metrics::group_type_options()[ $type ] ?? $type );
    }

    /**
     * Coaching groups covering each group: group id => [ [id, name, members], ... ]
     *
     * @param string $coaching_type group type key for coaching groups ('' = off)
     * @return array|WP_Error
     */
    private function coaching_by_group( string $coaching_type ) {
        if ( $coaching_type === '' ) {
            return [];
        }
        $result = dt_genmapper_plugin_queries()->coaching_coverage( $coaching_type );
        if ( is_wp_error( $result ) ) {
            return $result;
        }
        $coaching_groups = $result['coaching_groups'];
        return array_map( function ( $coaching_ids ) use ( $coaching_groups ) {
            return array_values( array_filter( array_map( function ( $id ) use ( $coaching_groups ) {
                if ( !isset( $coaching_groups[ $id ] ) ) {
                    return null;
                }
                $coaching_group = $coaching_groups[ $id ];
                return [
                    'id' => $coaching_group['id'],
                    'name' => $coaching_group['name'],
                    'members' => implode( ', ', $coaching_group['members'] ),
                ];
            }, $coaching_ids ) ) );
        }, $result['coverage'] );
    }

    /**
     * Generation number for every group: groups under the source (parent 0) are generation 1.
     *
     * @param array $groups tree rows keyed by id, each with a parent_id
     * @return array generation number keyed by group id
     */
    private function get_generations( array $groups ): array {
        $parents = [];
        foreach ( $groups as $group ) {
            $parents[ $group['id'] ] = $group['parent_id'] ?? 0;
        }
        $max_depth = count( $parents );

        $generations = [];
        foreach ( array_keys( $parents ) as $id ) {
            $generations[ $id ] = $this->get_generation( $id, $parents, $generations, $max_depth );
        }
        return $generations;
    }

    /**
     * Walk up the parent chain until the source node or a group whose generation is already known.
     */
    private function get_generation( $id, array $parents, array $known, int $max_depth ): int {
        $depth = 0;
        $current = $id;
        while ( !empty( $current ) && isset( $parents[ $current ] ) && $depth < $max_depth ) {
            if ( isset( $known[ $current ] ) ) {
                return $depth + $known[ $current ];
            }
            $depth++;
            $current = $parents[ $current ];
        }
        return max( $depth, 1 );
    }
}
