//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//
// @dart=2.12

// ignore_for_file: unused_element, unused_import
// ignore_for_file: always_put_required_named_parameters_first
// ignore_for_file: constant_identifier_names
// ignore_for_file: lines_longer_than_80_chars

part of openapi.api;

class CreateLibraryDto {
  /// Returns a new [CreateLibraryDto] instance.
  CreateLibraryDto({
    required this.libraryType,
  });

  LibraryTypeEnum libraryType;

  @override
  bool operator ==(Object other) => identical(this, other) || other is CreateLibraryDto &&
     other.libraryType == libraryType;

  @override
  int get hashCode =>
    // ignore: unnecessary_parenthesis
    (libraryType.hashCode);

  @override
  String toString() => 'CreateLibraryDto[libraryType=$libraryType]';

  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
      json[r'libraryType'] = this.libraryType;
    return json;
  }

  /// Returns a new [CreateLibraryDto] instance and imports its values from
  /// [value] if it's a [Map], null otherwise.
  // ignore: prefer_constructors_over_static_methods
  static CreateLibraryDto? fromJson(dynamic value) {
    if (value is Map) {
      final json = value.cast<String, dynamic>();

      return CreateLibraryDto(
        libraryType: LibraryTypeEnum.fromJson(json[r'libraryType'])!,
      );
    }
    return null;
  }

  static List<CreateLibraryDto> listFromJson(dynamic json, {bool growable = false,}) {
    final result = <CreateLibraryDto>[];
    if (json is List && json.isNotEmpty) {
      for (final row in json) {
        final value = CreateLibraryDto.fromJson(row);
        if (value != null) {
          result.add(value);
        }
      }
    }
    return result.toList(growable: growable);
  }

  static Map<String, CreateLibraryDto> mapFromJson(dynamic json) {
    final map = <String, CreateLibraryDto>{};
    if (json is Map && json.isNotEmpty) {
      json = json.cast<String, dynamic>(); // ignore: parameter_assignments
      for (final entry in json.entries) {
        final value = CreateLibraryDto.fromJson(entry.value);
        if (value != null) {
          map[entry.key] = value;
        }
      }
    }
    return map;
  }

  // maps a json object with a list of CreateLibraryDto-objects as value to a dart map
  static Map<String, List<CreateLibraryDto>> mapListFromJson(dynamic json, {bool growable = false,}) {
    final map = <String, List<CreateLibraryDto>>{};
    if (json is Map && json.isNotEmpty) {
      // ignore: parameter_assignments
      json = json.cast<String, dynamic>();
      for (final entry in json.entries) {
        map[entry.key] = CreateLibraryDto.listFromJson(entry.value, growable: growable,);
      }
    }
    return map;
  }

  /// The list of required keys that must be present in a JSON.
  static const requiredKeys = <String>{
    'libraryType',
  };
}
